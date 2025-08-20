# conversation_db的SQL操作

### 1. 数据库初始化

#### 表结构创建
```sql
-- 对话表
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

字段说明：

|    字段名    | 数据类型 |     约束与默认值      |                           说明                           |
| :----------: | :------: | :-------------------: | :------------------------------------------------------: |
|     `id`     |  `TEXT`  |     `PRIMARY KEY`     |        对话的唯一标识符（主键），不可重复且非空。        |
|   `title`    |  `TEXT`  | `NOT NULL DEFAULT ''` |       对话标题，默认值为空字符串，不可为 `NULL`。        |
| `created_at` |  `TEXT`  |      `NOT NULL`       | 对话创建时间，需明确指定值（如 `2023-01-01 12:00:00`）。 |
| `updated_at` |  `TEXT`  |      `NOT NULL`       | 对话最后更新时间，需明确指定值（与 `created_at` 类似）。 |

|      字段名       | 数据类型 |     约束与校验规则     |                             说明                             |
| :---------------: | :------: | :--------------------: | :----------------------------------------------------------: |
|       `id`        |  `TEXT`  |     `PRIMARY KEY`      |                  消息的唯一标识符（主键）。                  |
| `conversation_id` |  `TEXT`  |       `NOT NULL`       |          关联的对话 ID（对应 `conversations.id`）。          |
|      `role`       |  `TEXT`  | `CHECK(role IN (...))` | 消息发送者角色，仅允许 `'user'`、`'assistant'`、`'system'` 三种值 。 |
|     `content`     |  `TEXT`  |       `NOT NULL`       |                   消息正文内容，不可为空。                   |
|    `timestamp`    |  `TEXT`  |       `NOT NULL`       |                       消息发送时间戳。                       |

关键特性：

- 主键约束：id作为主键，确保每条对话记录唯一。

- 非空约束：所有字段均不可为NULL，保证数据完整性。

- **外键约束**：

  - `conversation_id`指向`conversations.id`，确保消息必须属于有效对话。
  - `ON DELETE CASCADE`：当对话被删除时，自动删除其关联的所有消息，避免孤儿数据 。

- **枚举值校验（`CHECK` 约束）**：`role` 字段通过 `CHECK` 强制限定角色类型，防止非法值（如 `'admin'`）写入 。

  

#### 索引创建

```sql
-- 对话表索引
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- 消息表索引
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON messages(content);
```

---



### 2. 对话管理操作

#### 创建对话
```sql
INSERT INTO conversations (id, title, created_at, updated_at)
VALUES (?, ?, ?, ?);
```

#### 删除对话
```sql
DELETE FROM conversations WHERE id = ?;
```

#### 更新对话标题
```sql
UPDATE conversations 
SET title = ?, updated_at = ? 
WHERE id = ?;
```

#### 查询对话
```sql
-- 获取单个对话
SELECT id, title, created_at, updated_at
FROM conversations
WHERE id = ?;

-- 获取所有对话（按更新时间倒序）
SELECT id, title, created_at, updated_at
FROM conversations
ORDER BY updated_at DESC;

-- 获取最近对话
SELECT id, title, created_at, updated_at
FROM conversations
ORDER BY updated_at DESC
LIMIT ?;
```

---



### 3. 消息管理操作

#### 添加消息
```sql
INSERT INTO messages (id, conversation_id, role, content, timestamp)
VALUES (?, ?, ?, ?, ?);
```

#### 更新消息
```sql
UPDATE messages SET content = ? WHERE id = ?;
```

#### 删除消息
```sql
DELETE FROM messages WHERE id = ?;
```

#### 查询消息
```sql
-- 获取对话的所有消息（按时间正序）
SELECT id, conversation_id, role, content, timestamp
FROM messages
WHERE conversation_id = ?
ORDER BY timestamp ASC;

-- 获取最近消息（按时间倒序）
SELECT id, conversation_id, role, content, timestamp
FROM messages
WHERE conversation_id = ?
ORDER BY timestamp DESC
LIMIT ?;
```

关键特性：

* `ORDER BY ... DESC`：按照`...`降序排列。

---



### 4. 搜索操作

#### 搜索对话
```sql
SELECT DISTINCT c.id, c.title, c.created_at, c.updated_at
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.title LIKE ? OR m.content LIKE ?
ORDER BY c.updated_at DESC;
```

该 SQL 查询用于 **检索符合条件的对话（conversations）**，并关联其消息（messages）。关键特性：

* `DISTINCT`：返回去重的对话信息。
* `LEFT JOIN`：即使对话无消息也保留记录。

#### 搜索消息

```sql
-- 全局搜索
SELECT id, conversation_id, role, content, timestamp
FROM messages
WHERE content LIKE ?
ORDER BY timestamp DESC;

-- 指定对话内搜索
SELECT id, conversation_id, role, content, timestamp
FROM messages
WHERE content LIKE ? AND conversation_id = ?
ORDER BY timestamp DESC;
```

---



### 5. 统计操作

#### 统计对话数量
```sql
SELECT COUNT(*) FROM conversations;
```

#### 统计消息数量
```sql
-- 全局消息数量
SELECT COUNT(*) FROM messages;

-- 指定对话的消息数量
SELECT COUNT(*) FROM messages WHERE conversation_id = ?;
```

---



### 6. 数据库维护操作

#### 数据压缩
```sql
VACUUM;
```

#### 事务管理
```sql
BEGIN TRANSACTION;
COMMIT;
ROLLBACK;
```

### 7. SQL操作特点

#### 参数化查询
- 使用`sqlite3_prepare_v2()`预编译SQL语句
- 使用`sqlite3_bind_*()`绑定参数，防止SQL注入
- 使用`sqlite3_step()`执行语句
- 使用`sqlite3_finalize()`释放资源

#### 错误处理
```cpp
// 检查SQL执行结果
if (rc == SQLITE_DONE) {
    // 操作成功
} else {
    // 记录错误
    logSQLError("operation_name");
}
```

#### 外键约束

- 启用外键约束：`PRAGMA foreign_keys = ON;`
- 消息表通过`conversation_id`关联对话表
- 删除对话时自动删除相关消息（CASCADE）

#### 时间戳处理
- 使用TEXT类型存储时间戳
- 格式：`YYYY-MM-DD HH:MM:SS`

