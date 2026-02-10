## 放置说明：
在 [spider](https://yale-lily.github.io/spider) 下载并解压后，请确保文件结构如下：
```bash
/Users/osp/Documents/GitHub/nexquery-ai/backend/storage/eval/spider/
├── dev.json
├── tables.json
└── database/
    ├── [db_id]/
    │   └── [db_id].sqlite
```

## 完成放置后，再次运行评测：
```bash
node ace eval:spider --limit 5

# 分批/跳过 (--offset)：你可以指定从第几个样本开始跑。
node ace eval:spider --limit 10 --offset 50

# 按数据库过滤 (--db)：你可以只跑特定的数据库（比如专门测试 concert_singer 相关题目）。
node ace eval:spider --db concert_singer
```
