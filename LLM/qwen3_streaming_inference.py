import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import json
import time
from typing import Iterator, Optional, Dict, Any
import warnings
warnings.filterwarnings("ignore")

class Qwen3StreamingInference:
    def __init__(self, 
                 model_path: str = "e:/TZB/LLM/model/Qwen3-0.6B",
                 lora_path: str = "e:/TZB/LLM/lora",
                 device: str = "auto"):
        """
        初始化Qwen3流式推理类
        
        Args:
            model_path: 基础模型路径
            lora_path: LoRA适配器路径
            device: 设备选择 ("auto", "cuda", "cpu")
        """
        self.model_path = model_path
        self.lora_path = lora_path
        
        # 自动选择设备
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
            
        print(f"使用设备: {self.device}")
        
        # 加载模型和分词器
        self._load_model_and_tokenizer()
        
    def _load_model_and_tokenizer(self):
        """加载模型和分词器"""
        print("正在加载分词器...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_path,
            trust_remote_code=True,
            padding_side="left"
        )
        
        # 设置pad_token
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
            
        print("正在加载基础模型...")
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_path,
            torch_dtype=torch.bfloat16 if self.device == "cuda" else torch.float32,
            device_map="auto" if self.device == "cuda" else None,
            trust_remote_code=True,
            low_cpu_mem_usage=True
        )
        
        if self.device == "cpu":
            self.model = self.model.to(self.device)
            
        print("正在加载LoRA适配器...")
        self.model = PeftModel.from_pretrained(
            self.model,
            self.lora_path,
            torch_dtype=torch.bfloat16 if self.device == "cuda" else torch.float32
        )
        
        # 合并LoRA权重以提高推理速度
        print("正在合并LoRA权重...")
        self.model = self.model.merge_and_unload()
        
        # 设置为评估模式
        self.model.eval()
        print("模型加载完成!")
        
    def format_chat_prompt(self, messages: list) -> str:
        """
        格式化聊天提示词
        
        Args:
            messages: 消息列表，格式为 [{"role": "user/assistant", "content": "..."}]
        """
        formatted_messages = []
        for message in messages:
            role = message["role"]
            content = message["content"]
            if role == "user":
                formatted_messages.append(f"<|im_start|>user\n{content}<|im_end|>")
            elif role == "assistant":
                formatted_messages.append(f"<|im_start|>assistant\n{content}<|im_end|>")
                
        # 添加助手开始标记
        formatted_messages.append("<|im_start|>assistant\n")
        return "\n".join(formatted_messages)
    
    @torch.no_grad()
    def stream_generate(self, 
                       prompt: str,
                       max_new_tokens: int = 4096,
                       temperature: float = 0.7,
                       top_p: float = 0.9,
                       top_k: int = 50,
                       repetition_penalty: float = 1.1,
                       do_sample: bool = True) -> Iterator[str]:
        """
        流式生成文本
        
        Args:
            prompt: 输入提示词
            max_new_tokens: 最大生成token数
            temperature: 温度参数
            top_p: nucleus sampling参数
            top_k: top-k sampling参数
            repetition_penalty: 重复惩罚
            do_sample: 是否使用采样
            
        Yields:
            str: 生成的文本片段
        """
        # 编码输入
        inputs = self.tokenizer.encode(prompt, return_tensors="pt").to(self.device)
        input_length = inputs.shape[1]
        
        # 生成参数
        generation_config = {
            "do_sample": do_sample,
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "repetition_penalty": repetition_penalty,
            "pad_token_id": self.tokenizer.pad_token_id,
            "eos_token_id": self.tokenizer.eos_token_id,
        }
        
        generated_text = ""
        
        for step in range(max_new_tokens):
            # 前向传播
            with torch.no_grad():
                outputs = self.model(inputs)
                logits = outputs.logits[:, -1, :]  # 获取最后一个位置的logits
                
                # 应用重复惩罚
                if repetition_penalty != 1.0:
                    for token_id in set(inputs[0].tolist()):
                        logits[0, token_id] /= repetition_penalty
                
                # 应用温度
                if temperature != 1.0:
                    logits = logits / temperature
                
                # Top-k filtering
                if top_k > 0:
                    top_k_logits, top_k_indices = torch.topk(logits, top_k)
                    logits_filtered = torch.full_like(logits, float('-inf'))
                    logits_filtered.scatter_(1, top_k_indices, top_k_logits)
                    logits = logits_filtered
                
                # Top-p (nucleus) filtering
                if top_p < 1.0:
                    sorted_logits, sorted_indices = torch.sort(logits, descending=True)
                    cumulative_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)
                    
                    # 移除累积概率超过top_p的token
                    sorted_indices_to_remove = cumulative_probs > top_p
                    sorted_indices_to_remove[..., 1:] = sorted_indices_to_remove[..., :-1].clone()
                    sorted_indices_to_remove[..., 0] = 0
                    
                    indices_to_remove = sorted_indices_to_remove.scatter(1, sorted_indices, sorted_indices_to_remove)
                    logits[indices_to_remove] = float('-inf')
                
                # 采样下一个token
                if do_sample:
                    probs = F.softmax(logits, dim=-1)
                    next_token = torch.multinomial(probs, num_samples=1)
                else:
                    next_token = torch.argmax(logits, dim=-1, keepdim=True)
                
                # 检查是否生成了结束token
                if next_token.item() == self.tokenizer.eos_token_id:
                    break
                
                # 解码新生成的token
                new_text = self.tokenizer.decode(next_token[0], skip_special_tokens=True)
                
                # 检查是否是特殊结束标记
                if "<|im_end|>" in new_text:
                    break
                    
                generated_text += new_text
                yield new_text
                
                # 更新输入序列
                inputs = torch.cat([inputs, next_token], dim=-1)
                
                # 防止序列过长导致内存问题
                if inputs.shape[1] > 4096:  # 根据模型的max_position_embeddings调整
                    # 保留最近的token
                    inputs = inputs[:, -2048:]
    
    def chat_stream(self, 
                   messages: list,
                   max_new_tokens: int = 4096,
                   temperature: float = 0.7,
                   top_p: float = 0.9,
                   **kwargs) -> Iterator[str]:
        """
        聊天模式的流式生成
        
        Args:
            messages: 消息历史
            max_new_tokens: 最大生成token数
            temperature: 温度参数
            top_p: nucleus sampling参数
            **kwargs: 其他生成参数
            
        Yields:
            str: 生成的文本片段
        """
        prompt = self.format_chat_prompt(messages)
        yield from self.stream_generate(
            prompt=prompt,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            **kwargs
        )

def main():
    """示例使用"""
    # 初始化推理器
    inference = Qwen3StreamingInference()
    
    # 示例1: 简单文本生成
    print("=== 简单文本生成示例 ===")
    prompt = "请介绍一下人工智能的发展历程："+get_global_info();
    print(f"输入: {prompt}")
    print("输出: ", end="", flush=True)
    
    for text_chunk in inference.stream_generate(prompt, max_new_tokens=200):
        print(text_chunk, end="", flush=True)
        time.sleep(0.05)  # 模拟打字机效果
    print("\n")
    
    # 示例2: 聊天模式
    print("=== 聊天模式示例 ===")
    messages = [
        {"role": "user", "content": "你好，请介绍一下自己"}
    ]
    
    print("用户: 你好，请介绍一下自己")
    print("助手: ", end="", flush=True)
    
    response = ""
    for text_chunk in inference.chat_stream(messages, max_new_tokens=300):
        print(text_chunk, end="", flush=True)
        response += text_chunk
        time.sleep(0.05)
    print("\n")
    
    # 继续对话
    messages.append({"role": "assistant", "content": response})
    messages.append({"role": "user", "content": "你能帮我写一个Python函数来计算斐波那契数列吗？"})
    
    print("用户: 你能帮我写一个Python函数来计算斐波那契数列吗？")
    print("助手: ", end="", flush=True)
    
    for text_chunk in inference.chat_stream(messages, max_new_tokens=400):
        print(text_chunk, end="", flush=True)
        time.sleep(0.05)
    print("\n")

if __name__ == "__main__":
    main()