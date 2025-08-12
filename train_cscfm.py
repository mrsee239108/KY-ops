#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
CSCFM模型训练脚本
使用test_logs目录下的日志文件训练异常检测模型
"""

import os
import sys
import json
import logging
import argparse
from typing import List, Dict
import numpy as np
import torch
from torch.utils.data import DataLoader
from sklearn.model_selection import train_test_split

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from cscfm_model import (
    JiebaDrainParser, 
    CSCFMModel, 
    CSCFMTrainer, 
    LogDataProcessor,
    LogSequenceDataset,
    collate_fn
)

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CSCFMModelTrainer:
    """
    CSCFM模型训练主类
    """
    
    def __init__(self, 
                 test_logs_dir: str = "test_logs",
                 model_save_dir: str = "models",
                 device: str = None):
        """
        初始化训练器
        
        Args:
            test_logs_dir: 测试日志目录
            model_save_dir: 模型保存目录
            device: 训练设备
        """
        self.test_logs_dir = test_logs_dir
        self.model_save_dir = model_save_dir
        
        # 设置设备
        if device is None:
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        else:
            self.device = device
            
        logger.info(f"使用设备: {self.device}")
        
        # 创建模型保存目录
        os.makedirs(model_save_dir, exist_ok=True)
        
        # 初始化组件
        self.parser = JiebaDrainParser()
        self.processor = LogDataProcessor(self.parser)
        self.model = None
        self.trainer = None
        
    def prepare_data(self) -> tuple:
        """
        准备训练数据
        
        Returns:
            训练和验证数据集
        """
        logger.info("开始准备训练数据...")
        
        all_sequences = []
        
        # 定义日志文件和对应的标签
        log_files = {
            'system.log': 1,  # 异常日志（包含错误信息）
            'HDFS_2k.log': 0,  # 正常日志
            'Linux_2k.log': 0,  # 正常日志
            'OpenSSH_2k.log': 0,  # 正常日志
            'Spark_2k.log': 0,  # 正常日志
            'BGL_2k.log': 0,  # 正常日志
        }
        
        # 处理每个日志文件
        for filename, label in log_files.items():
            filepath = os.path.join(self.test_logs_dir, filename)
            if os.path.exists(filepath):
                logger.info(f"处理日志文件: {filename} (标签: {label})")
                sequences = self.processor.process_log_file(filepath, label)
                all_sequences.extend(sequences)
                logger.info(f"从 {filename} 提取了 {len(sequences)} 个序列")
            else:
                logger.warning(f"日志文件不存在: {filepath}")
        
        logger.info(f"总共提取了 {len(all_sequences)} 个日志序列")
        
        # 统计标签分布
        labels = [seq['label'] for seq in all_sequences]
        normal_count = labels.count(0)
        anomaly_count = labels.count(1)
        logger.info(f"正常序列: {normal_count}, 异常序列: {anomaly_count}")
        
        # 如果异常样本太少，创建一些人工异常样本
        if anomaly_count < len(all_sequences) * 0.1:
            logger.info("异常样本较少，创建人工异常样本...")
            artificial_anomalies = self._create_artificial_anomalies(all_sequences[:50])
            all_sequences.extend(artificial_anomalies)
            logger.info(f"添加了 {len(artificial_anomalies)} 个人工异常样本")
        
        # 分割训练和验证集
        train_sequences, val_sequences = train_test_split(
            all_sequences, test_size=0.2, random_state=42, stratify=[seq['label'] for seq in all_sequences]
        )
        
        logger.info(f"训练集: {len(train_sequences)} 个序列")
        logger.info(f"验证集: {len(val_sequences)} 个序列")
        
        # 创建数据集
        train_dataset = LogSequenceDataset(train_sequences, [seq['label'] for seq in train_sequences], max_seq_len=50)
        val_dataset = LogSequenceDataset(val_sequences, [seq['label'] for seq in val_sequences], max_seq_len=50)
        
        return train_dataset, val_dataset
    
    def _create_artificial_anomalies(self, normal_sequences: List[Dict]) -> List[Dict]:
        """
        创建人工异常样本
        
        Args:
            normal_sequences: 正常序列列表
            
        Returns:
            人工异常序列列表
        """
        artificial_anomalies = []
        
        for seq in normal_sequences:
            # 创建异常序列的几种方法：
            # 1. 随机打乱模板顺序
            anomaly_seq1 = {
                'templates': seq['templates'].copy(),
                'timestamps': seq['timestamps'].copy(),
                'components': seq['components'].copy(),
                'trace_id': seq.get('trace_id', ''),
                'label': 1
            }
            np.random.shuffle(anomaly_seq1['templates'])
            artificial_anomalies.append(anomaly_seq1)
            
            # 2. 替换随机模板（而不是插入，保持长度不变）
            if len(seq['templates']) > 10:
                anomaly_seq2 = {
                    'templates': seq['templates'].copy(),
                    'timestamps': seq['timestamps'].copy(),
                    'components': seq['components'].copy(),
                    'trace_id': seq.get('trace_id', ''),
                    'label': 1
                }
                # 随机替换几个模板
                num_replacements = min(3, len(anomaly_seq2['templates']) // 4)
                replace_indices = np.random.choice(len(anomaly_seq2['templates']), num_replacements, replace=False)
                for idx in replace_indices:
                    random_template = np.random.randint(0, max(1, self.processor.get_vocab_size()))
                    anomaly_seq2['templates'][idx] = random_template
                artificial_anomalies.append(anomaly_seq2)
        
        return artificial_anomalies[:100]  # 限制数量
    
    def build_model(self) -> CSCFMModel:
        """
        构建CSCFM模型
        
        Returns:
            CSCFM模型实例
        """
        logger.info("构建CSCFM模型...")
        
        vocab_size = self.processor.get_vocab_size()
        num_components = self.processor.get_num_components()
        
        logger.info(f"词汇表大小: {vocab_size}")
        logger.info(f"组件数量: {num_components}")
        
        model = CSCFMModel(
            vocab_size=vocab_size,
            embed_dim=256,  # 减小嵌入维度以适应CPU训练
            hidden_dim=128,  # 减小隐藏层维度
            num_components=min(num_components, 50),  # 限制组件数量
            num_classes=2,
            dropout=0.1,
            alpha_emb=0.7
        )
        
        logger.info(f"模型参数数量: {sum(p.numel() for p in model.parameters())}")
        
        return model
    
    def train_model(self, 
                   train_dataset: LogSequenceDataset, 
                   val_dataset: LogSequenceDataset,
                   epochs: int = 20,
                   batch_size: int = 8,
                   learning_rate: float = 0.001) -> Dict:
        """
        训练模型
        
        Args:
            train_dataset: 训练数据集
            val_dataset: 验证数据集
            epochs: 训练轮数
            batch_size: 批次大小
            learning_rate: 学习率
            
        Returns:
            训练历史
        """
        logger.info("开始训练模型...")
        
        # 创建数据加载器
        train_loader = DataLoader(
            train_dataset, 
            batch_size=2, 
            shuffle=True, 
            collate_fn=collate_fn
        )
        val_loader = DataLoader(
            val_dataset, 
            batch_size=2, 
            shuffle=False, 
            collate_fn=collate_fn
        )
        
        # 构建模型
        self.model = self.build_model()
        
        # 创建训练器
        self.trainer = CSCFMTrainer(
            model=self.model,
            device=self.device,
            learning_rate=learning_rate
        )
        
        # 训练历史
        history = {
            'train_loss': [],
            'val_loss': [],
            'val_accuracy': [],
            'val_f1_score': []
        }
        
        best_f1 = 0.0
        
        for epoch in range(epochs):
            logger.info(f"Epoch {epoch + 1}/{epochs}")
            
            # 训练
            train_loss = self.trainer.train_epoch(train_loader)
            
            # 验证
            val_metrics = self.trainer.evaluate(val_loader)
            
            # 记录历史
            history['train_loss'].append(train_loss)
            history['val_loss'].append(val_metrics['loss'])
            history['val_accuracy'].append(val_metrics['accuracy'])
            history['val_f1_score'].append(val_metrics['f1_score'])
            
            logger.info(f"训练损失: {train_loss:.4f}")
            logger.info(f"验证损失: {val_metrics['loss']:.4f}")
            logger.info(f"验证准确率: {val_metrics['accuracy']:.4f}")
            logger.info(f"验证F1分数: {val_metrics['f1_score']:.4f}")
            
            # 保存最佳模型
            if val_metrics['f1_score'] > best_f1:
                best_f1 = val_metrics['f1_score']
                self.save_model('best_model.pth')
                logger.info(f"保存最佳模型 (F1: {best_f1:.4f})")
            
            # 学习率调度
            self.trainer.scheduler.step()
        
        logger.info("训练完成!")
        logger.info(f"最佳F1分数: {best_f1:.4f}")
        
        return history
    
    def save_model(self, filename: str):
        """
        保存模型和相关数据
        
        Args:
            filename: 文件名
        """
        model_path = os.path.join(self.model_save_dir, filename)
        
        # 保存模型
        if self.trainer:
            self.trainer.save_model(model_path)
        
        # 保存解析器模板
        templates_path = os.path.join(self.model_save_dir, 'templates.pkl')
        self.parser.save_templates(templates_path)
        
        # 保存词汇表映射
        vocab_path = os.path.join(self.model_save_dir, 'vocab.json')
        vocab_data = {
            'template_to_id': self.processor.template_to_id,
            'component_to_id': self.processor.component_to_id,
            'vocab_size': self.processor.get_vocab_size(),
            'num_components': self.processor.get_num_components()
        }
        with open(vocab_path, 'w', encoding='utf-8') as f:
            json.dump(vocab_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"模型已保存到: {model_path}")
        logger.info(f"模板已保存到: {templates_path}")
        logger.info(f"词汇表已保存到: {vocab_path}")
    
    def load_model(self, filename: str):
        """
        加载模型和相关数据
        
        Args:
            filename: 文件名
        """
        model_path = os.path.join(self.model_save_dir, filename)
        templates_path = os.path.join(self.model_save_dir, 'templates.pkl')
        vocab_path = os.path.join(self.model_save_dir, 'vocab.json')
        
        # 加载词汇表
        with open(vocab_path, 'r', encoding='utf-8') as f:
            vocab_data = json.load(f)
        
        self.processor.template_to_id = vocab_data['template_to_id']
        self.processor.component_to_id = vocab_data['component_to_id']
        self.processor.next_template_id = vocab_data['vocab_size']
        self.processor.next_component_id = vocab_data['num_components']
        
        # 加载模板
        self.parser.load_templates(templates_path)
        
        # 构建和加载模型
        self.model = self.build_model()
        self.trainer = CSCFMTrainer(self.model, self.device)
        self.trainer.load_model(model_path)
        
        logger.info(f"模型已从 {model_path} 加载")
    
    def predict(self, log_messages: List[str]) -> List[Dict]:
        """
        预测日志异常
        
        Args:
            log_messages: 日志消息列表
            
        Returns:
            预测结果列表
        """
        if not self.model or not self.trainer:
            raise ValueError("模型未加载，请先训练或加载模型")
        
        # 处理日志消息
        sequence = {
            'templates': [],
            'timestamps': [],
            'components': []
        }
        
        for log_msg in log_messages:
            parsed = self.parser.parse_log(log_msg)
            timestamp = self.processor._extract_timestamp(log_msg)
            component = self.processor._extract_component(log_msg)
            
            template_id = self.processor._get_template_id(parsed['template'])
            component_id = self.processor._get_component_id(component)
            
            sequence['templates'].append(template_id)
            sequence['timestamps'].append(timestamp)
            sequence['components'].append(component_id)
        
        # 创建数据集
        dataset = LogSequenceDataset([sequence], [0])  # 标签不重要，只是为了兼容
        dataloader = DataLoader(dataset, batch_size=1, collate_fn=collate_fn)
        
        # 预测
        self.model.eval()
        with torch.no_grad():
            for batch in dataloader:
                batch = {k: v.to(self.device) for k, v in batch.items() if k != 'label'}
                logits = self.model(batch)
                probs = torch.softmax(logits, dim=1)
                pred = torch.argmax(logits, dim=1)
                
                return [{
                    'prediction': pred.item(),
                    'confidence': probs[0][pred.item()].item(),
                    'probabilities': {
                        'normal': probs[0][0].item(),
                        'anomaly': probs[0][1].item()
                    }
                }]


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='训练CSCFM日志异常检测模型')
    parser.add_argument('--test_logs_dir', default='test_logs', help='测试日志目录')
    parser.add_argument('--model_save_dir', default='models', help='模型保存目录')
    parser.add_argument('--epochs', type=int, default=20, help='训练轮数')
    parser.add_argument('--batch_size', type=int, default=8, help='批次大小')
    parser.add_argument('--learning_rate', type=float, default=0.001, help='学习率')
    parser.add_argument('--device', default=None, help='训练设备')
    
    args = parser.parse_args()
    
    # 创建训练器
    trainer = CSCFMModelTrainer(
        test_logs_dir=args.test_logs_dir,
        model_save_dir=args.model_save_dir,
        device=args.device
    )
    
    try:
        # 准备数据
        train_dataset, val_dataset = trainer.prepare_data()
        
        # 训练模型
        history = trainer.train_model(
            train_dataset=train_dataset,
            val_dataset=val_dataset,
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.learning_rate
        )
        
        # 保存最终模型
        trainer.save_model('final_model.pth')
        
        # 保存训练历史
        history_path = os.path.join(args.model_save_dir, 'training_history.json')
        with open(history_path, 'w') as f:
            json.dump(history, f, indent=2)
        
        logger.info("训练完成！")
        
    except Exception as e:
        logger.error(f"训练过程中出现错误: {e}")
        raise


if __name__ == "__main__":
    main()