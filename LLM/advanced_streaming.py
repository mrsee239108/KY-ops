import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer
from peft import PeftModel
import threading
import queue
import time
from typing import Iterator, Optional, Dict, Any, List
from dataclasses import dataclass
import json

@dataclass
class GenerationConfig:
    """生成配置类"""
    max_new_tokens: int = 4096
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 50
    repetition_penalty: float = 1.1
    do_sample: bool = True
    num_beams: int = 1
    # 移除 early_stopping 参数，因为在新版本transformers中流式生成可能不支持
    # early_stopping: bool = True
    length_penalty: float = 1.0

class AdvancedQwen3Streaming:
    def __init__(self, 
                 model_path: str = "e:/TZB/LLM/model/Qwen3-0.6B",
                 lora_path: str = "e:/TZB/LLM/lora",
                 device: str = "auto",
                 load_in_8bit: bool = False,
                 load_in_4bit: bool = False):
        """
        高级Qwen3流式推理类
        
        Args:
            model_path: 基础模型路径
            lora_path: LoRA适配器路径
            device: 设备选择
            load_in_8bit: 是否使用8bit量化
            load_in_4bit: 是否使用4bit量化
        """
        self.model_path = model_path
        self.lora_path = lora_path
        self.load_in_8bit = load_in_8bit
        self.load_in_4bit = load_in_4bit
        
        # 设备配置
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
            
        print(f"使用设备: {self.device}")
        if self.device == "cuda":
            print(f"GPU显存: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
        
        self._load_model_and_tokenizer()
        
    def _load_model_and_tokenizer(self):
        """加载模型和分词器"""
        print("正在加载分词器...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_path,
            trust_remote_code=True,
            padding_side="left"
        )
        
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
            
        print("正在加载基础模型...")
        
        # 模型加载配置
        model_kwargs = {
            "trust_remote_code": True,
            "low_cpu_mem_usage": True,
        }
        
        if self.device == "cuda":
            model_kwargs.update({
                "torch_dtype": torch.bfloat16,
                "device_map": "auto",
            })
            
            if self.load_in_8bit:
                model_kwargs["load_in_8bit"] = True
            elif self.load_in_4bit:
                model_kwargs["load_in_4bit"] = True
        else:
            model_kwargs["torch_dtype"] = torch.float32
            
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_path,
            **model_kwargs
        )
        
        if self.device == "cpu":
            self.model = self.model.to(self.device)
            
        print("正在加载LoRA适配器...")
        self.model = PeftModel.from_pretrained(
            self.model,
            self.lora_path,
            torch_dtype=torch.bfloat16 if self.device == "cuda" else torch.float32
        )
        
        print("正在合并LoRA权重...")
        self.model = self.model.merge_and_unload()
        self.model.eval()
        
        print("模型加载完成!")
        
    def format_messages(self, messages: List[Dict[str, str]]) -> str:
        """格式化消息为Qwen格式"""
        formatted = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                formatted.append(f"<|im_start|>system\n{content}<|im_end|>")
            elif role == "user":
                formatted.append(f"<|im_start|>user\n{content}<|im_end|>")
            elif role == "assistant":
                formatted.append(f"<|im_start|>assistant\n{content}<|im_end|>")
        
        # 添加助手开始标记
        formatted.append("<|im_start|>assistant\n")
        return "\n".join(formatted)

    @torch.no_grad()
    def generate_stream(self, 
                       prompt: str,
                       config: GenerationConfig = None) -> Iterator[str]:
        """
        使用TextIteratorStreamer的流式生成
        """
        if config is None:
            config = GenerationConfig()
            
        # 编码输入
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        
        # 创建流式器
        streamer = TextIteratorStreamer(
            self.tokenizer,
            skip_prompt=True,
            skip_special_tokens=True,
            timeout=30.0
        )
        
        # 生成参数 - 移除不支持的 early_stopping 参数
        generation_kwargs = {
            **inputs,
            "max_new_tokens": config.max_new_tokens,
            "temperature": config.temperature,
            "top_p": config.top_p,
            "top_k": config.top_k,
            "repetition_penalty": config.repetition_penalty,
            "do_sample": config.do_sample,
            "num_beams": config.num_beams,
            # 移除 early_stopping 参数，避免警告
            # "early_stopping": config.early_stopping,
            "length_penalty": config.length_penalty,
            "streamer": streamer,
            "pad_token_id": self.tokenizer.pad_token_id,
            "eos_token_id": self.tokenizer.eos_token_id,
        }
        
        # 在单独线程中运行生成
        generation_thread = threading.Thread(
            target=self.model.generate,
            kwargs=generation_kwargs
        )
        generation_thread.start()
        
        # 流式输出
        for new_text in streamer:
            if new_text:
                yield new_text
                
        # 等待生成线程完成
        generation_thread.join()

    def chat_stream(self, 
                   messages: List[Dict[str, str]],
                   config: GenerationConfig = None) -> Iterator[str]:
        """
        聊天模式的流式生成
        
        Args:
            messages: 消息历史
            config: 生成配置
        """
        prompt = self.format_messages(messages)
        return self.generate_stream(prompt, config)

    def get_model_info(self) -> Dict[str, Any]:
        """获取模型信息"""
        return {
            "model_path": self.model_path,
            "lora_path": self.lora_path,
            "device": self.device,
            "load_in_8bit": self.load_in_8bit,
            "load_in_4bit": self.load_in_4bit,
            "vocab_size": len(self.tokenizer),
            "model_type": self.model.config.model_type if hasattr(self.model, 'config') else "unknown"
        }

# 测试函数
def test_streaming():
    """测试流式生成"""
    print("初始化模型...")
    model = AdvancedQwen3Streaming()
    
    messages = [
        {"role": "user", "content": "你好，请介绍一下你自己"}
    ]
    
    print("\n开始流式生成:")
    for chunk in model.chat_stream(messages):
        print(chunk, end="", flush=True)
    print("\n\n生成完成!")

if __name__ == "__main__":
    test_streaming()