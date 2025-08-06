"""
AI服务模块 - 管理LLM模型实例和对话功能
"""
import os
import sys
import threading
import time
from typing import Dict, Any, List, Iterator, Optional
import json
from datetime import datetime

# 添加LLM目录到Python路径
llm_path = os.path.join(os.path.dirname(__file__), 'LLM')
if llm_path not in sys.path:
    sys.path.insert(0, llm_path)

try:
    from advanced_streaming import AdvancedQwen3Streaming, GenerationConfig
    LLM_AVAILABLE = True
except ImportError as e:
    print(f"警告: 无法导入LLM模块: {e}")
    LLM_AVAILABLE = False

class AIService:
    """AI服务类"""
    
    def __init__(self):
        self.model_instance = None
        self.is_loading = False
        self.load_error = None
        self.conversation_history = {}
        self._lock = threading.Lock()
        
        # 启动时自动初始化模型
        print("AI服务已创建，准备初始化模型...")
        self.initialize_model()
        
    def initialize_model(self):
        """初始化AI模型"""
        if not LLM_AVAILABLE:
            self.load_error = "LLM模块不可用"
            return False
            
        if self.model_instance is not None:
            return True
            
        if self.is_loading:
            return False
            
        def load_model():
            try:
                self.is_loading = True
                print("=" * 50)
                print("开始初始化AI模型...")
                print("=" * 50)
                
                # 检查模型文件是否存在
                model_path = os.path.join(os.path.dirname(__file__), 'LLM', 'model', 'Qwen3-0.6B')
                lora_path = os.path.join(os.path.dirname(__file__), 'LLM', 'lora')
                
                print(f"检查模型路径: {model_path}")
                if not os.path.exists(model_path):
                    raise FileNotFoundError(f"模型路径不存在: {model_path}")
                print("✓ 模型路径检查通过")
                
                print(f"检查LoRA路径: {lora_path}")
                if not os.path.exists(lora_path):
                    raise FileNotFoundError(f"LoRA路径不存在: {lora_path}")
                print("✓ LoRA路径检查通过")
                
                print("正在加载模型，这可能需要几分钟时间...")
                start_time = time.time()
                
                self.model_instance = AdvancedQwen3Streaming(
                    model_path=model_path,
                    lora_path=lora_path,
                    device="auto"
                )
                
                load_time = time.time() - start_time
                print("=" * 50)
                print(f"✓ AI模型初始化完成! 耗时: {load_time:.2f}秒")
                print("=" * 50)
                self.load_error = None
                
            except Exception as e:
                print("=" * 50)
                print(f"✗ AI模型初始化失败: {e}")
                print("=" * 50)
                self.load_error = str(e)
                self.model_instance = None
            finally:
                self.is_loading = False
        
        # 在后台线程中加载模型
        threading.Thread(target=load_model, daemon=True).start()
        return False
    
    def is_model_ready(self) -> bool:
        """检查模型是否准备就绪"""
        return self.model_instance is not None and not self.is_loading
    
    def get_model_status(self) -> Dict[str, Any]:
        """获取模型状态"""
        return {
            "available": LLM_AVAILABLE,
            "loaded": self.model_instance is not None,
            "loading": self.is_loading,
            "error": self.load_error
        }
    
    def chat_with_ai(self, message: str, conversation_id: str = None, stream: bool = False) -> Dict[str, Any]:
        """与AI对话"""
        if not self.is_model_ready():
            if not LLM_AVAILABLE:
                return self._fallback_response(message)
            elif self.is_loading:
                return {"error": "模型正在加载中，请稍后再试", "loading": True}
            elif self.load_error:
                return {"error": f"模型加载失败: {self.load_error}"}
            else:
                # 尝试初始化模型
                self.initialize_model()
                return {"error": "模型未初始化，正在启动中...", "loading": True}
        
        try:
            # 获取或创建对话历史
            if conversation_id is None:
                conversation_id = f"conv_{int(time.time() * 1000)}"
            
            with self._lock:
                if conversation_id not in self.conversation_history:
                    self.conversation_history[conversation_id] = []
                
                # 添加用户消息到历史
                self.conversation_history[conversation_id].append({
                    "role": "user",
                    "content": message,
                    "timestamp": datetime.now().isoformat()
                })
                
                # 准备消息列表（只保留最近的对话）
                messages = self.conversation_history[conversation_id][-10:]  # 保留最近10轮对话
                
                # 添加系统提示
                system_message = {
                    "role": "system",
                    "content": "你是一个专业的运维助手，专门帮助用户解决系统运维、性能监控、安全管理等相关问题。请用专业、友好的语气回答用户的问题。"
                }
                chat_messages = [system_message] + messages
            
            if stream:
                # 流式响应
                def generate_response():
                    response_text = ""
                    try:
                        config = GenerationConfig(
                            max_new_tokens=4096,
                            temperature=0.7,
                            top_p=0.9,
                            repetition_penalty=1.1
                        )
                        
                        for chunk in self.model_instance.chat_stream(chat_messages, config):
                            if chunk:  # 只处理非空chunk
                                response_text += chunk
                                yield {
                                    "content": chunk,
                                    "conversation_id": conversation_id
                                }
                        
                        # 添加AI回复到历史
                        with self._lock:
                            self.conversation_history[conversation_id].append({
                                "role": "assistant",
                                "content": response_text,
                                "timestamp": datetime.now().isoformat()
                            })
                        
                    except Exception as e:
                        yield {
                            "error": str(e),
                            "conversation_id": conversation_id
                        }
                
                return {
                    "stream": generate_response(),
                    "conversation_id": conversation_id
                }
            
            else:
                # 非流式响应
                response_text = ""
                config = GenerationConfig(
                    max_new_tokens=4096,
                    temperature=0.7,
                    top_p=0.9,
                    repetition_penalty=1.1
                )
                
                for chunk in self.model_instance.chat_stream(chat_messages, config):
                    response_text += chunk
                
                # 添加AI回复到历史
                with self._lock:
                    self.conversation_history[conversation_id].append({
                        "role": "assistant",
                        "content": response_text,
                        "timestamp": datetime.now().isoformat()
                    })
                
                return {
                    "response": response_text,
                    "conversation_id": conversation_id,
                    "timestamp": datetime.now().strftime('%H:%M:%S'),
                    "message_id": f"msg_{int(time.time() * 1000)}"
                }
                
        except Exception as e:
            print(f"AI对话错误: {e}")
            return {"error": f"AI对话失败: {str(e)}"}
    
    def _fallback_response(self, message: str) -> Dict[str, Any]:
        """备用响应（当AI模型不可用时）"""
        import random
        
        responses = [
            "抱歉，AI模型当前不可用。我是一个简单的回复系统。",
            "AI服务暂时无法使用，但我可以为您提供基本的帮助。",
            "当前使用备用响应系统。请稍后再试AI功能。"
        ]
        
        # 简单的关键词回复
        if any(word in message.lower() for word in ['系统', 'system', '监控', 'monitor']):
            ai_response = "我可以帮您监控系统状态、管理文件、查看进程等。您需要什么帮助？"
        elif any(word in message.lower() for word in ['帮助', 'help', '功能']):
            ai_response = "我可以帮助您：\n1. 回答各种问题\n2. 提供系统信息\n3. 协助文件管理\n4. 解释技术概念\n5. 进行日常对话\n\n请告诉我您需要什么帮助！"
        else:
            ai_response = random.choice(responses)
        
        return {
            'response': ai_response,
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'message_id': f"msg_{int(time.time() * 1000)}",
            'fallback': True
        }
    
    def get_conversation_history(self, conversation_id: str) -> List[Dict[str, Any]]:
        """获取对话历史"""
        with self._lock:
            return self.conversation_history.get(conversation_id, [])
    
    def clear_conversation(self, conversation_id: str = None):
        """清空对话历史"""
        with self._lock:
            if conversation_id:
                self.conversation_history.pop(conversation_id, None)
            else:
                self.conversation_history.clear()
    
    def get_model_info(self) -> Dict[str, Any]:
        """获取模型信息"""
        if not self.is_model_ready():
            return {"error": "模型未加载"}
        
        try:
            return self.model_instance.get_model_info()
        except Exception as e:
            return {"error": str(e)}

# 全局AI服务实例
ai_service = AIService()