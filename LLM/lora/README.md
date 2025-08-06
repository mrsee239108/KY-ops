---
library_name: peft
license: other
base_model: C:\Users\Administrator\.cache\modelscope\hub\models\Qwen\Qwen3-0.6B
tags:
- llama-factory
- lora
- generated_from_trainer
model-index:
- name: train_2025-08-05-22-53-12
  results: []
---

<!-- This model card has been generated automatically according to the information the Trainer had access to. You
should probably proofread and complete it, then remove this comment. -->

# train_2025-08-05-22-53-12

This model is a fine-tuned version of [C:\Users\Administrator\.cache\modelscope\hub\models\Qwen\Qwen3-0.6B](https://huggingface.co/C:\Users\Administrator\.cache\modelscope\hub\models\Qwen\Qwen3-0.6B) on the [Easy Dataset] [x5dr29YqfRpJ] Alpaca dataset.
It achieves the following results on the evaluation set:
- Loss: 1.6765
- Num Input Tokens Seen: 29644728

## Model description

More information needed

## Intended uses & limitations

More information needed

## Training and evaluation data

More information needed

## Training procedure

### Training hyperparameters

The following hyperparameters were used during training:
- learning_rate: 5e-05
- train_batch_size: 1
- eval_batch_size: 1
- seed: 42
- gradient_accumulation_steps: 8
- total_train_batch_size: 8
- optimizer: Use OptimizerNames.ADAMW_TORCH with betas=(0.9,0.999) and epsilon=1e-08 and optimizer_args=No additional optimizer arguments
- lr_scheduler_type: cosine
- num_epochs: 3.0

### Training results



### Framework versions

- PEFT 0.15.2
- Transformers 4.52.4
- Pytorch 2.7.1+cu118
- Datasets 3.6.0
- Tokenizers 0.21.1