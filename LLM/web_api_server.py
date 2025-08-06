from flask import Flask, request, jsonify, Response, render_template_string
import json
import time
from advanced_streaming import AdvancedQwen3Streaming, GenerationConfig
from typing import Dict, Any

app = Flask(__name__)

# 全局模型实例
model_instance = None

def init_model():
    """初始化模型"""
    global model_instance
    if model_instance is None:
        print("正在初始化模型...")
        model_instance = AdvancedQwen3Streaming()
        print("模型初始化完成!")

# 简单的HTML测试页面
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qwen3-0.6B API 测试页面</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 10px 0; }
        .endpoint { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
        .method { color: #007bff; font-weight: bold; }
        .url { background: #e9ecef; padding: 5px; border-radius: 3px; font-family: monospace; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
        button:hover { background: #0056b3; }
        textarea { width: 100%; height: 100px; margin: 10px 0; }
        .response { background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; white-space: pre-wrap; }
        .status { padding: 5px 10px; border-radius: 3px; color: white; }
        .status.healthy { background: #28a745; }
        .status.error { background: #dc3545; }
    </style>
</head>
<body>
    <h1>🤖 Qwen3-0.6B API 测试页面</h1>
    
    <div class="container">
        <h2>服务状态</h2>
        <button onclick="checkHealth()">检查健康状态</button>
        <button onclick="getModelInfo()">获取模型信息</button>
        <div id="status-result"></div>
    </div>

    <div class="container">
        <h2>API 端点</h2>
        
        <div class="endpoint">
            <h3><span class="method">GET</span> /health</h3>
            <p>检查服务健康状态</p>
            <div class="url">{{ base_url }}/health</div>
        </div>

        <div class="endpoint">
            <h3><span class="method">GET</span> /model/info</h3>
            <p>获取模型详细信息</p>
            <div class="url">{{ base_url }}/model/info</div>
        </div>

        <div class="endpoint">
            <h3><span class="method">POST</span> /generate</h3>
            <p>文本生成接口</p>
            <div class="url">{{ base_url }}/generate</div>
            <textarea id="generate-prompt" placeholder='{"prompt": "你好，请介绍一下自己", "max_new_tokens": 200, "temperature": 0.7}'></textarea>
            <button onclick="testGenerate()">测试生成</button>
        </div>

        <div class="endpoint">
            <h3><span class="method">POST</span> /chat</h3>
            <p>聊天对话接口</p>
            <div class="url">{{ base_url }}/chat</div>
            <textarea id="chat-messages" placeholder='{"messages": [{"role": "user", "content": "你好"}], "max_new_tokens": 200}'></textarea>
            <button onclick="testChat()">测试聊天</button>
        </div>
    </div>

    <div class="container">
        <h2>测试结果</h2>
        <div id="test-result" class="response"></div>
    </div>

    <script>
        const baseUrl = window.location.origin;

        async function checkHealth() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                const statusClass = data.status === 'healthy' ? 'healthy' : 'error';
                document.getElementById('status-result').innerHTML = 
                    `<div class="status ${statusClass}">状态: ${data.status} | 模型已加载: ${data.model_loaded}</div>`;
            } catch (error) {
                document.getElementById('status-result').innerHTML = 
                    `<div class="status error">错误: ${error.message}</div>`;
            }
        }

        async function getModelInfo() {
            try {
                const response = await fetch('/model/info');
                const data = await response.json();
                document.getElementById('test-result').textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('test-result').textContent = `错误: ${error.message}`;
            }
        }

        async function testGenerate() {
            const prompt = document.getElementById('generate-prompt').value || 
                '{"prompt": "你好，请介绍一下自己", "max_new_tokens": 200, "temperature": 0.7}';
            
            try {
                const data = JSON.parse(prompt);
                const response = await fetch('/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                document.getElementById('test-result').textContent = JSON.stringify(result, null, 2);
            } catch (error) {
                document.getElementById('test-result').textContent = `错误: ${error.message}`;
            }
        }

        async function testChat() {
            const messages = document.getElementById('chat-messages').value || 
                '{"messages": [{"role": "user", "content": "你好"}], "max_new_tokens": 200}';
            
            try {
                const data = JSON.parse(messages);
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                document.getElementById('test-result').textContent = JSON.stringify(result, null, 2);
            } catch (error) {
                document.getElementById('test-result').textContent = `错误: ${error.message}`;
            }
        }

        // 页面加载时自动检查健康状态
        window.onload = function() {
            checkHealth();
        };
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    """主页 - API测试界面"""
    base_url = request.url_root.rstrip('/')
    return render_template_string(HTML_TEMPLATE, base_url=base_url)

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({"status": "healthy", "model_loaded": model_instance is not None})

@app.route('/model/info', methods=['GET'])
def model_info():
    """获取模型信息"""
    if model_instance is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    return jsonify(model_instance.get_model_info())

@app.route('/api/endpoints', methods=['GET'])
def list_endpoints():
    """列出所有可用的API端点"""
    endpoints = []
    for rule in app.url_map.iter_rules():
        endpoints.append({
            "endpoint": rule.endpoint,
            "methods": list(rule.methods),
            "url": str(rule)
        })
    return jsonify({"endpoints": endpoints})

@app.route('/generate', methods=['POST'])
def generate_text():
    """文本生成接口"""
    if model_instance is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    data = request.json
    prompt = data.get('prompt', '')
    stream = data.get('stream', False)
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
    
    # 生成配置
    config = GenerationConfig(
        max_new_tokens=data.get('max_new_tokens', 4096),
        temperature=data.get('temperature', 0.7),
        top_p=data.get('top_p', 0.9),
        top_k=data.get('top_k', 50),
        repetition_penalty=data.get('repetition_penalty', 1.1),
        do_sample=data.get('do_sample', True)
    )
    
    if stream:
        def generate():
            for chunk in model_instance.generate_stream(prompt, config):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        
        return Response(generate(), mimetype='text/plain')
    else:
        # 非流式生成
        response_text = ""
        for chunk in model_instance.generate_stream(prompt, config):
            response_text += chunk
        
        return jsonify({"text": response_text})

@app.route('/chat', methods=['POST'])
def chat():
    """聊天接口"""
    if model_instance is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    data = request.json
    messages = data.get('messages', [])
    stream = data.get('stream', False)
    
    if not messages:
        return jsonify({"error": "Messages are required"}), 400
    
    # 生成配置
    config = GenerationConfig(
        max_new_tokens=data.get('max_new_tokens', 4096),
        temperature=data.get('temperature', 0.7),
        top_p=data.get('top_p', 0.9),
        repetition_penalty=data.get('repetition_penalty', 1.1)
    )
    
    if stream:
        def generate():
            for chunk in model_instance.chat_stream(messages, config):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        
        return Response(generate(), mimetype='text/plain')
    else:
        response_text = ""
        for chunk in model_instance.chat_stream(messages, config):
            response_text += chunk
        
        return jsonify({"text": response_text})

if __name__ == '__main__':
    init_model()
    app.run(host='0.0.0.0', port=8000, debug=False, threaded=True)