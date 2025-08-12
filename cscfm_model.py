#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
基于组件子序列相关性融合的日志异常检测模型（CSCFM）
Component Subsequence Correlation Fusion Model for Log Anomaly Detection

实现论文中描述的CSCFM模型，包括：
1. Jieba+Drain模板解析
2. 基于组件子序列相关性融合的异常检测
3. 模型训练和预测功能
"""

import re
import time
import json
import pickle
import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional, Any
from collections import defaultdict, Counter
from datetime import datetime
import hashlib

# 深度学习相关
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torch_geometric.nn import GCNConv
from sentence_transformers import SentenceTransformer

# 中文分词
import jieba
import jieba.posseg as pseg

# 日志解析
from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JiebaDrainParser:
    """
    结合Jieba分词和Drain解析器的日志模板解析模型
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        初始化解析器
        
        Args:
            config_path: Drain配置文件路径
        """
        # 中文正则表达式
        self.chinese_regexp = re.compile(r'[\u4e00-\u9fff]+')
        self.punctuation_regexp = re.compile(r'[。，：；！？、]')
        self.non_chinese_regexp = re.compile(r'[^\u4e00-\u9fff]+')
        
        # 初始化Jieba分词
        jieba.initialize()
        
        # 初始化Drain解析器
        if config_path:
            config = TemplateMinerConfig()
            config.load(config_path)
        else:
            config = TemplateMinerConfig()
            config.drain_extra_delimiters = ['=', ':', ',', ';']
            config.drain_sim_th = 0.4
            config.drain_depth = 4
            config.drain_max_children = 100
            
        self.template_miner = TemplateMiner(config=config)
        self.templates = {}
        
    def segment_mixed_text(self, text: str) -> List[str]:
        """
        对中英混合文本进行分词
        
        Args:
            text: 输入文本
            
        Returns:
            分词结果列表
        """
        text = text.strip()
        tokens = []
        
        # 找到所有中文、标点符号和非中文片段
        segments = []
        
        # 中文片段
        for match in self.chinese_regexp.finditer(text):
            segments.append({
                'start': match.start(),
                'end': match.end(),
                'text': match.group(),
                'type': 'chinese'
            })
            
        # 标点符号
        for match in self.punctuation_regexp.finditer(text):
            segments.append({
                'start': match.start(),
                'end': match.end(),
                'text': match.group(),
                'type': 'punctuation'
            })
            
        # 非中文片段
        for match in self.non_chinese_regexp.finditer(text):
            segments.append({
                'start': match.start(),
                'end': match.end(),
                'text': match.group(),
                'type': 'non_chinese'
            })
            
        # 按位置排序
        segments.sort(key=lambda x: x['start'])
        
        # 分词处理
        for segment in segments:
            if segment['type'] == 'chinese':
                # 使用Jieba分词
                words = list(jieba.cut(segment['text']))
                tokens.extend([w for w in words if w.strip()])
            elif segment['type'] == 'non_chinese':
                # 使用特殊字符分割
                words = re.split(r'[\s\[\](){}=:,;]+', segment['text'])
                tokens.extend([w for w in words if w.strip()])
            elif segment['type'] == 'punctuation':
                if segment['text'].strip():
                    tokens.append(segment['text'])
                    
        return tokens
    
    def parse_log(self, log_message: str) -> Dict[str, Any]:
        """
        解析单条日志
        
        Args:
            log_message: 日志消息
            
        Returns:
            解析结果
        """
        # 预处理日志消息
        processed_message = self._preprocess_log(log_message)
        
        # 分词
        tokens = self.segment_mixed_text(processed_message)
        tokenized_message = ' '.join(tokens)
        
        # 使用Drain解析
        result = self.template_miner.add_log_message(tokenized_message)
        
        template_id = result['cluster_id']
        template = result['template_mined']
        
        # 存储模板
        if template_id not in self.templates:
            self.templates[template_id] = {
                'template': template,
                'count': 0,
                'examples': []
            }
            
        self.templates[template_id]['count'] += 1
        if len(self.templates[template_id]['examples']) < 5:
            self.templates[template_id]['examples'].append(log_message)
            
        return {
            'template_id': template_id,
            'template': template,
            'tokens': tokens,
            'original_message': log_message,
            'processed_message': processed_message
        }
    
    def _preprocess_log(self, log_message: str) -> str:
        """
        预处理日志消息
        
        Args:
            log_message: 原始日志消息
            
        Returns:
            预处理后的日志消息
        """
        # 移除时间戳
        message = re.sub(r'\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}', '', log_message)
        message = re.sub(r'\d{6}\s+\d{6}', '', message)
        
        # 移除日志级别
        message = re.sub(r'\b(DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)\b', '', message)
        
        # 移除IP地址
        message = re.sub(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '<IP>', message)
        
        # 移除数字
        message = re.sub(r'\b\d+\b', '<NUM>', message)
        
        return message.strip()
    
    def get_templates(self) -> Dict[int, Dict[str, Any]]:
        """
        获取所有模板
        
        Returns:
            模板字典
        """
        return self.templates
    
    def save_templates(self, filepath: str):
        """
        保存模板到文件
        
        Args:
            filepath: 文件路径
        """
        with open(filepath, 'wb') as f:
            pickle.dump(self.templates, f)
            
    def load_templates(self, filepath: str):
        """
        从文件加载模板
        
        Args:
            filepath: 文件路径
        """
        with open(filepath, 'rb') as f:
            self.templates = pickle.load(f)


class LogSequenceDataset(Dataset):
    """
    日志序列数据集
    """
    
    def __init__(self, sequences: List[Dict], labels: List[int], max_seq_len: int = 100):
        """
        初始化数据集
        
        Args:
            sequences: 日志序列列表
            labels: 标签列表
            max_seq_len: 最大序列长度
        """
        self.sequences = sequences
        self.labels = labels
        self.max_seq_len = max_seq_len
        
    def __len__(self):
        return len(self.sequences)
    
    def __getitem__(self, idx):
        sequence = self.sequences[idx]
        label = self.labels[idx]
        
        # 确保序列长度一致
        templates = sequence['templates'][:self.max_seq_len]
        timestamps = sequence['timestamps'][:self.max_seq_len]
        components = sequence['components'][:self.max_seq_len]
        
        # 填充到固定长度
        while len(templates) < self.max_seq_len:
            templates.append(0)
            timestamps.append(0.0)
            components.append(0)
        
        return {
            'templates': templates,
            'timestamps': timestamps,
            'components': components,
            'trace_id': sequence.get('trace_id', ''),
            'label': label
        }


class CSCFMModel(nn.Module):
    """
    基于组件子序列相关性融合的异常检测模型
    Component Subsequence Correlation Fusion Model
    """
    
    def __init__(self, 
                 vocab_size: int,
                 embed_dim: int = 768,
                 hidden_dim: int = 256,
                 num_components: int = 50,
                 num_classes: int = 2,
                 dropout: float = 0.1,
                 alpha_emb: float = 0.7):
        """
        初始化CSCFM模型
        
        Args:
            vocab_size: 词汇表大小
            embed_dim: 嵌入维度
            hidden_dim: 隐藏层维度
            num_components: 组件数量
            num_classes: 分类数量
            dropout: Dropout率
            alpha_emb: 语义特征权重
        """
        super(CSCFMModel, self).__init__()
        
        self.vocab_size = vocab_size
        self.embed_dim = embed_dim
        self.hidden_dim = hidden_dim
        self.num_components = num_components
        self.num_classes = num_classes
        self.dropout = dropout
        self.alpha_emb = alpha_emb
        
        # 语义特征维度和时间特征维度
        self.sem_dim = int(alpha_emb * hidden_dim)
        self.time_dim = hidden_dim - self.sem_dim
        
        # 模板嵌入层
        self.template_embedding = nn.Embedding(vocab_size, embed_dim)
        
        # 语义特征映射
        self.semantic_mlp = nn.Sequential(
            nn.Linear(embed_dim, self.sem_dim),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        
        # 时间特征映射
        self.time_mlp = nn.Sequential(
            nn.Linear(1, self.time_dim),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        
        # LSTM层
        self.lstm = nn.LSTM(hidden_dim, hidden_dim, batch_first=True, bidirectional=False)
        
        # 子序列相关性建模
        self.edge_mlp = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        
        self.edge_conv = nn.Conv1d(hidden_dim, 1, kernel_size=1)
        
        # GCN层
        self.gcn1 = GCNConv(hidden_dim, hidden_dim)
        self.gcn2 = GCNConv(hidden_dim, hidden_dim)
        
        # 注意力机制
        self.attention_query = nn.Parameter(torch.randn(hidden_dim))
        self.attention_mlp = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh()
        )
        
        # 分类器
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, num_classes)
        )
        
        # 初始化权重
        self._init_weights()
        
    def _init_weights(self):
        """初始化模型权重"""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
            elif isinstance(module, nn.Embedding):
                nn.init.xavier_uniform_(module.weight)
                
    def forward(self, batch):
        """
        前向传播
        
        Args:
            batch: 批次数据
            
        Returns:
            分类结果
        """
        # 提取输入
        templates = batch['templates']  # [batch_size, seq_len]
        timestamps = batch['timestamps']  # [batch_size, seq_len]
        components = batch['components']  # [batch_size, seq_len]
        
        batch_size, seq_len = templates.shape
        
        # 1. 子序列建模
        # 语义特征提取
        template_embeds = self.template_embedding(templates)  # [batch_size, seq_len, embed_dim]
        semantic_features = self.semantic_mlp(template_embeds)  # [batch_size, seq_len, sem_dim]
        
        # 时间特征提取
        time_features = self.time_mlp(timestamps.unsqueeze(-1))  # [batch_size, seq_len, time_dim]
        
        # 特征融合
        combined_features = torch.cat([semantic_features, time_features], dim=-1)  # [batch_size, seq_len, hidden_dim]
        
        # LSTM时序特征提取
        lstm_out, (hidden, _) = self.lstm(combined_features)
        sequence_feature = hidden.squeeze(0)  # [batch_size, hidden_dim]
        
        # 2. 按组件拆分子序列
        component_features = self._extract_component_subsequences(
            lstm_out, components, batch_size
        )  # [batch_size, num_components, hidden_dim]
        
        # 3. 子序列相关性建模
        correlation_features = self._model_subsequence_correlation(
            component_features, batch_size
        )  # [batch_size, num_components, hidden_dim]
        
        # 4. 子序列特征融合
        fused_features = self._fuse_subsequence_features(
            correlation_features, batch_size
        )  # [batch_size, hidden_dim]
        
        # 5. 最终特征组合和分类
        final_features = torch.cat([sequence_feature, fused_features], dim=-1)
        logits = self.classifier(final_features)
        
        return logits
    
    def _extract_component_subsequences(self, lstm_out, components, batch_size):
        """
        按组件提取子序列特征
        
        Args:
            lstm_out: LSTM输出 [batch_size, seq_len, hidden_dim]
            components: 组件标识 [batch_size, seq_len]
            batch_size: 批次大小
            
        Returns:
            组件子序列特征 [batch_size, num_components, hidden_dim]
        """
        component_features = torch.zeros(batch_size, self.num_components, self.hidden_dim).to(lstm_out.device)
        
        for b in range(batch_size):
            for c in range(self.num_components):
                # 找到属于组件c的位置
                mask = (components[b] == c)
                if mask.any():
                    # 对该组件的特征进行平均池化
                    component_features[b, c] = lstm_out[b][mask].mean(dim=0)
                    
        return component_features
    
    def _model_subsequence_correlation(self, component_features, batch_size):
        """
        建模子序列相关性
        
        Args:
            component_features: 组件特征 [batch_size, num_components, hidden_dim]
            batch_size: 批次大小
            
        Returns:
            相关性特征 [batch_size, num_components, hidden_dim]
        """
        correlation_features = torch.zeros_like(component_features)
        
        for b in range(batch_size):
            features = component_features[b]  # [num_components, hidden_dim]
            
            # 构建边特征
            edge_features = []
            edge_indices = []
            
            for i in range(self.num_components):
                for j in range(i + 1, self.num_components):
                    # 连接两个组件的特征
                    edge_feat = torch.cat([features[i], features[j]], dim=0)
                    edge_features.append(edge_feat)
                    edge_indices.append([i, j])
                    edge_indices.append([j, i])  # 无向图
                    
            if edge_features:
                edge_features = torch.stack(edge_features)  # [num_edges, hidden_dim*2]
                edge_indices = torch.tensor(edge_indices).t().to(features.device)  # [2, num_edges*2]
                
                # 计算边权重
                edge_weights = self.edge_mlp(edge_features)  # [num_edges, hidden_dim]
                edge_weights = edge_weights.transpose(0, 1).unsqueeze(0)  # [1, hidden_dim, num_edges]
                edge_weights = self.edge_conv(edge_weights).squeeze()  # [num_edges]
                edge_weights = torch.sigmoid(edge_weights)
                
                # 复制权重用于无向图
                edge_weights = edge_weights.repeat(2)
                
                # GCN传播
                x = F.relu(self.gcn1(features, edge_indices, edge_weights))
                x = F.dropout(x, self.dropout, training=self.training)
                x = self.gcn2(x, edge_indices, edge_weights)
                
                correlation_features[b] = x
            else:
                correlation_features[b] = features
                
        return correlation_features
    
    def _fuse_subsequence_features(self, correlation_features, batch_size):
        """
        融合子序列特征
        
        Args:
            correlation_features: 相关性特征 [batch_size, num_components, hidden_dim]
            batch_size: 批次大小
            
        Returns:
            融合特征 [batch_size, hidden_dim]
        """
        fused_features = torch.zeros(batch_size, self.hidden_dim).to(correlation_features.device)
        
        for b in range(batch_size):
            features = correlation_features[b]  # [num_components, hidden_dim]
            
            # 计算注意力权重
            attention_scores = torch.matmul(features, self.attention_query)  # [num_components]
            attention_weights = F.softmax(attention_scores, dim=0)  # [num_components]
            
            # 加权融合
            fused_features[b] = torch.sum(features * attention_weights.unsqueeze(-1), dim=0)
            
        return fused_features


class CSCFMTrainer:
    """
    CSCFM模型训练器
    """
    
    def __init__(self, 
                 model: CSCFMModel,
                 device: str = 'cpu',
                 learning_rate: float = 0.001,
                 weight_decay: float = 1e-5):
        """
        初始化训练器
        
        Args:
            model: CSCFM模型
            device: 设备
            learning_rate: 学习率
            weight_decay: 权重衰减
        """
        self.model = model.to(device)
        self.device = device
        self.optimizer = torch.optim.Adam(
            model.parameters(), 
            lr=learning_rate, 
            weight_decay=weight_decay
        )
        self.criterion = nn.CrossEntropyLoss()
        self.scheduler = torch.optim.lr_scheduler.StepLR(
            self.optimizer, step_size=10, gamma=0.9
        )
        
    def train_epoch(self, dataloader: DataLoader) -> float:
        """
        训练一个epoch
        
        Args:
            dataloader: 数据加载器
            
        Returns:
            平均损失
        """
        self.model.train()
        total_loss = 0.0
        num_batches = 0
        
        for batch in dataloader:
            # 移动数据到设备
            batch = self._move_to_device(batch)
            
            # 前向传播
            logits = self.model(batch)
            loss = self.criterion(logits, batch['label'])
            
            # 反向传播
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
            
        return total_loss / num_batches
    
    def evaluate(self, dataloader: DataLoader) -> Dict[str, float]:
        """
        评估模型
        
        Args:
            dataloader: 数据加载器
            
        Returns:
            评估指标
        """
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        all_preds = []
        all_labels = []
        
        with torch.no_grad():
            for batch in dataloader:
                batch = self._move_to_device(batch)
                
                logits = self.model(batch)
                loss = self.criterion(logits, batch['label'])
                
                total_loss += loss.item()
                
                preds = torch.argmax(logits, dim=1)
                correct += (preds == batch['label']).sum().item()
                total += batch['label'].size(0)
                
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(batch['label'].cpu().numpy())
        
        accuracy = correct / total
        avg_loss = total_loss / len(dataloader)
        
        # 计算F1分数
        from sklearn.metrics import f1_score, precision_score, recall_score
        f1 = f1_score(all_labels, all_preds, average='weighted')
        precision = precision_score(all_labels, all_preds, average='weighted')
        recall = recall_score(all_labels, all_preds, average='weighted')
        
        return {
            'loss': avg_loss,
            'accuracy': accuracy,
            'f1_score': f1,
            'precision': precision,
            'recall': recall
        }
    
    def _move_to_device(self, batch):
        """移动批次数据到设备"""
        for key in ['templates', 'timestamps', 'components', 'label']:
            if key in batch:
                batch[key] = batch[key].to(self.device)
        return batch
    
    def save_model(self, filepath: str):
        """保存模型"""
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
        }, filepath)
        
    def load_model(self, filepath: str):
        """加载模型"""
        checkpoint = torch.load(filepath, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])


class LogDataProcessor:
    """
    日志数据处理器
    """
    
    def __init__(self, parser: JiebaDrainParser):
        """
        初始化数据处理器
        
        Args:
            parser: 日志解析器
        """
        self.parser = parser
        self.template_to_id = {}
        self.component_to_id = {}
        self.next_template_id = 0
        self.next_component_id = 0
        
    def process_log_file(self, filepath: str, label: int = 0) -> List[Dict]:
        """
        处理日志文件
        
        Args:
            filepath: 日志文件路径
            label: 标签（0=正常，1=异常）
            
        Returns:
            处理后的日志序列列表
        """
        sequences = []
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            
        # 按会话窗口分组（这里简化为按时间窗口）
        current_sequence = {
            'templates': [],
            'timestamps': [],
            'components': [],
            'trace_id': '',
            'label': label
        }
        
        for line in lines[:1000]:  # 限制处理数量以加快速度
            line = line.strip()
            if not line:
                continue
                
            # 解析日志
            parsed = self.parser.parse_log(line)
            
            # 提取时间戳
            timestamp = self._extract_timestamp(line)
            
            # 提取组件
            component = self._extract_component(line)
            
            # 转换为ID
            template_id = self._get_template_id(parsed['template'])
            component_id = self._get_component_id(component)
            
            current_sequence['templates'].append(template_id)
            current_sequence['timestamps'].append(timestamp)
            current_sequence['components'].append(component_id)
            
            # 简单的序列分割策略：每100条日志为一个序列
            if len(current_sequence['templates']) >= 50:
                sequences.append(current_sequence.copy())
                current_sequence = {
                    'templates': [],
                    'timestamps': [],
                    'components': [],
                    'trace_id': '',
                    'label': label
                }
                
        # 添加最后一个序列
        if current_sequence['templates']:
            sequences.append(current_sequence)
            
        return sequences
    
    def _extract_timestamp(self, log_line: str) -> float:
        """提取时间戳"""
        # 尝试提取不同格式的时间戳
        patterns = [
            r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})',
            r'(\d{6}\s+\d{6})',
            r'(\d{4}-\d{2}-\d{2}-\d{2}\.\d{2}\.\d{2})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, log_line)
            if match:
                try:
                    time_str = match.group(1)
                    if '-' in time_str and ':' in time_str:
                        dt = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
                    elif '-' in time_str and '.' in time_str:
                        dt = datetime.strptime(time_str, '%Y-%m-%d-%H.%M.%S')
                    else:
                        # 简单的数字时间戳
                        return float(time.time())
                    return dt.timestamp()
                except:
                    pass
                    
        return float(time.time())
    
    def _extract_component(self, log_line: str) -> str:
        """提取组件名称"""
        # 尝试提取组件名称的模式
        patterns = [
            r'dfs\.(\w+)',
            r'com\.[\w\.]+\.(\w+)',
            r'\[([^\]]+)\]',
            r'(\w+)\(',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, log_line)
            if match:
                return match.group(1)
                
        return 'unknown'
    
    def _get_template_id(self, template: str) -> int:
        """获取模板ID"""
        if template not in self.template_to_id:
            self.template_to_id[template] = self.next_template_id
            self.next_template_id += 1
        return self.template_to_id[template]
    
    def _get_component_id(self, component: str) -> int:
        """获取组件ID"""
        if component not in self.component_to_id:
            self.component_to_id[component] = self.next_component_id
            self.next_component_id += 1
        return self.component_to_id[component]
    
    def get_vocab_size(self) -> int:
        """获取词汇表大小"""
        return self.next_template_id
    
    def get_num_components(self) -> int:
        """获取组件数量"""
        return self.next_component_id


def collate_fn(batch):
    """
    数据加载器的collate函数
    """
    templates = []
    timestamps = []
    components = []
    labels = []
    
    for item in batch:
        # 直接使用已经填充好的序列
        templates.append(item['templates'])
        timestamps.append(item['timestamps'])
        components.append(item['components'])
        labels.append(item['label'])
    
    return {
        'templates': torch.tensor(templates, dtype=torch.long),
        'timestamps': torch.tensor(timestamps, dtype=torch.float),
        'components': torch.tensor(components, dtype=torch.long),
        'label': torch.tensor(labels, dtype=torch.long)
    }


if __name__ == "__main__":
    # 测试代码
    print("CSCFM模型实现完成")
    print("包含以下主要组件：")
    print("1. JiebaDrainParser - Jieba+Drain模板解析器")
    print("2. CSCFMModel - 基于组件子序列相关性融合的异常检测模型")
    print("3. CSCFMTrainer - 模型训练器")
    print("4. LogDataProcessor - 日志数据处理器")