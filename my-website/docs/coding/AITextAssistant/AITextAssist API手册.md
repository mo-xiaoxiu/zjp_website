# AITextAssist API手册

## HTTP路由handler系列

### handleApiChat

```cpp
HttpResponse HttpServer::handleApiChat(const HttpRequest& request) { /* .... */ }
```

**函数功能解析**

`HttpServer::handleApiChat` 是一个处理 HTTP API 请求的函数，主要用于接收用户输入的聊天消息，调用 AI 助手（`assistant_`）进行处理，并返回 JSON 格式的响应。以下是其核心功能：

1. **请求验证**：
   - 检查 AI 助手（`assistant_`）是否可用，如果不可用，返回 `500` 错误。
   - 解析请求体中的 JSON 数据，提取用户消息（`message`）和会话 ID（`conversation_id`）。

2. **会话管理**：
   - 如果请求中指定了 `conversation_id`，尝试加载对应的会话；如果会话不存在，则创建一个新会话。
   - 如果未指定 `conversation_id`，直接创建一个新会话。

3. **消息处理**：
   - 检查用户消息长度（限制为 8000 字符），超长则返回 `400` 错误。
   - 调用 `assistant_->processTextInput` 处理用户消息，生成 AI 助手的回复。

4. **响应封装**：
   - 将处理结果封装为 JSON 格式的响应，包括状态、会话 ID、AI 回复等信息。
   - 捕获异常并返回错误信息（如 JSON 解析失败或处理异常）。

**JSON 封装格式与内容要求**

**1. 请求格式**

请求体必须是一个合法的 JSON 对象，包含以下字段：
- **`message`**（必需）：用户输入的聊天消息（字符串）。
- **`conversation_id`**（可选）：会话 ID（字符串），用于继续之前的对话。如果未提供或为 `null`，则创建新会话。

**示例请求**：
```json
{
    "message": "你好，今天天气怎么样？",
    "conversation_id": "conv_123"
}
```

**2. 响应格式**

响应是一个 JSON 对象，包含以下字段：
- **`status`**：请求处理状态（如 `"success"` 或 `"error"`）。
- **`conversation_id`**：当前会话的 ID（字符串）。
- **`response`**：AI 助手的回复内容（字符串）。
- **`is_split`**（可选）：标记回复是否被截断（布尔值，默认为 `false`）。

**成功响应示例**：
```json
{
    "status": "success",
    "conversation_id": "conv_123",
    "response": "今天天气晴朗，气温 25°C。",
    "is_split": false
}
```

**错误响应示例**：

- 助手不可用：
  ```json
  {
      "error": "Assistant not available"
  }
  ```
- 消息过长：
  ```json
  {
      "error": "Message too long. Maximum length is 8000 characters.",
      "current_length": 10000
  }
  ```
- 无效请求：
  ```json
  {
      "error": "Invalid request: Failed to parse JSON"
  }
  ```

---

### handleApiConversations

```cpp
HttpResponse HttpServer::handleApiConversations(const HttpRequest& /* request */) { }
```

**函数功能解析**

`HttpServer::handleApiConversations` 是一个处理 HTTP API 请求的函数，主要用于获取 AI 助手（`assistant_`）的最近会话列表，并以 JSON 格式返回这些会话的摘要信息。以下是其核心功能：

1. **请求验证**：
   - 检查 AI 助手（`assistant_`）是否可用，如果不可用，返回 `500` 错误。
   - 调用 `assistant_->getRecentConversations(10)` 获取最近的 10 个会话。

2. **会话列表封装**：
   - 遍历会话列表，将每个会话的 ID、标题和创建时间转换为 JSON 格式。
   - 创建时间通过 `std::chrono` 转换为秒级时间戳。

3. **响应封装**：
   - 将会话列表封装为 JSON 数组，并作为响应体返回。
   - 捕获异常并返回错误信息（如获取会话失败）。

**JSON 封装格式与内容要求**

**1. 请求格式**

- 此函数不需要请求体（`HttpRequest& /* request */` 被注释掉），仅通过 HTTP GET 方法调用。

**2. 响应格式**

响应是一个 JSON 对象，包含以下字段：
- **`conversations`**：一个数组，每个元素是一个会话对象，包含以下字段：
  - **`id`**：会话的唯一标识符（字符串）。
  - **`title`**：会话的标题（字符串）。
  - **`created_at`**：会话的创建时间（秒级 Unix 时间戳）。

**成功响应示例**：
```json
{
    "conversations": [
        {
            "id": "conv_123",
            "title": "讨论天气",
            "created_at": 1630000000
        },
        {
            "id": "conv_456",
            "title": "技术支持",
            "created_at": 1630001000
        }
    ]
}
```

**错误响应示例**：
- 助手不可用：
  ```json
  {
      "error": "Assistant not available"
  }
  ```
- 获取会话失败：
  ```json
  {
      "error": "Failed to get conversations: Database connection failed"
  }
  ```

---

### handleApiDeleteConversation

```cpp
HttpResponse HttpServer::handleApiDeleteConversation(const HttpRequest& request) { }
```

**函数功能解析**

`HttpServer::handleApiDeleteConversation` 是一个处理 HTTP API 请求的函数，主要用于删除指定的 AI 助手会话（`conversation`）。以下是其核心功能：

1. **请求验证**：
   - 检查 AI 助手（`assistant_`）是否可用，如果不可用，返回 `500` 错误。
   - 解析请求体中的 JSON 数据，提取会话 ID（`conversation_id`）。
   - 验证 `conversation_id` 是否为空，若为空则返回 `400` 错误。

2. **会话删除**：
   - 调用 `assistant_->deleteConversation(conversation_id)` 尝试删除指定会话。
   - 根据删除操作的成功与否，返回不同的响应状态和消息。

3. **响应封装**：
   - 如果删除成功，返回 `success` 和成功消息。
   - 如果删除失败（如会话不存在），返回 `404` 错误。
   - 捕获异常并返回错误信息（如 JSON 解析失败或无效请求）。

**JSON 封装格式与内容要求**

**1. 请求格式**

请求体必须是一个合法的 JSON 对象，包含以下字段：
- **`conversation_id`**（必需）：要删除的会话 ID（字符串）。

**示例请求**：
```json
{
    "conversation_id": "conv_123"
}
```

**2. 响应格式**

响应是一个 JSON 对象，包含以下字段：
- **成功响应**：
  - **`success`**：操作是否成功（布尔值，`true`）。
  - **`message`**：成功消息（字符串）。

  **示例**：
  ```json
  {
      "success": true,
      "message": "Conversation deleted successfully"
  }
  ```

- **失败响应**：
  - **`error`**：错误原因（字符串）。
    - 如果会话不存在或删除失败，返回 `404` 状态码和错误信息。
    - 如果请求无效（如 JSON 解析失败），返回 `400` 状态码和错误信息。

  **示例**：
  - 会话不存在：
    ```json
    {
        "error": "Conversation not found or could not be deleted"
    }
    ```
  - 无效请求：
    ```json
    {
        "error": "Invalid request: conversation_id is required"
    }
    ```

---

### handleApiStatus

```cpp
HttpResponse HttpServer::handleApiStatus(const HttpRequest& /* request */) { }
```

**函数功能解析**

`HttpServer::handleApiStatus` 是一个处理 HTTP API 请求的函数，主要用于返回当前服务器的运行状态和 AI 助手的基本统计信息。以下是其核心功能：

1. **状态检查**：
   - 返回服务器的运行状态（`"running"`）和版本号（`"1.0.0"`）。
   - 检查 AI 助手（`assistant_`）是否可用，并通过 `assistant_available` 字段标识。

2. **统计信息**：
   - 如果 AI 助手可用，返回以下统计信息：
     - `total_conversations`：当前系统中存在的会话总数。
     - `total_messages`：当前系统中存储的消息总数。

3. **响应封装**：
   - 所有信息封装为 JSON 格式，并通过 HTTP 响应返回。

**JSON 封装格式与内容要求**

**1. 请求格式**

- 此函数不需要请求体（`HttpRequest& /* request */` 被注释掉），仅通过 HTTP GET 方法调用。

**2. 响应格式**

响应是一个 JSON 对象，包含以下字段：
- **`status`**：服务器运行状态（固定为 `"running"`）。
- **`version`**：服务器版本号（字符串，如 `"1.0.0"`）。
- **`assistant_available`**：AI 助手是否可用（布尔值）。
- **`total_conversations`**（可选）：当前会话总数（整数，仅在 `assistant_` 可用时返回）。
- **`total_messages`**（可选）：当前消息总数（整数，仅在 `assistant_` 可用时返回）。

**成功响应示例**：
```json
{
    "status": "running",
    "version": "1.0.0",
    "assistant_available": true,
    "total_conversations": 42,
    "total_messages": 1000
}
```

**如果 AI 助手不可用**：
```json
{
    "status": "running",
    "version": "1.0.0",
    "assistant_available": false
}
```

---

### handleOpenAIChat

```cpp
HttpResponse HttpServer::handleOpenAIChat(const HttpRequest& request) { }
```

**函数功能解析**

`HttpServer::handleOpenAIChat` 是一个处理 HTTP API 请求的函数，主要用于模拟 OpenAI 的聊天补全（Chat Completion）接口。以下是其核心功能：

1. **请求验证**：
   - 检查 AI 助手（`assistant_`）是否可用，如果不可用，返回 `500` 错误。
   - 解析请求体中的 JSON 数据，验证 `messages` 字段是否存在且为数组。
   - 从 `messages` 中提取最后一个用户消息（`role: "user"` 的 `content`），如果未找到则返回 `400` 错误。

2. **消息处理**：
   - 调用 `assistant_->processTextInput(user_message)` 处理用户消息，生成助手回复。
   - 支持**流式（`stream`）和非流式**两种响应模式（当前实现中，流式模式仅返回简单响应）。

3. **响应封装**：
   - 返回的 JSON 结构模仿 OpenAI 的聊天补全接口格式，包含以下字段：
     - `id`：生成的唯一对话 ID。
     - `object`：固定为 `"chat.completion"`。
     - `created`：时间戳。
     - `model`：使用的模型名称（默认为 `"gpt-3.5-turbo"`）。
     - `choices`：包含助手回复的数组。
     - `usage`：令牌使用统计（估算值）。

4. **错误处理**：
   - 捕获 JSON 解析异常或其他错误，返回 `400` 状态码和详细错误信息。

**JSON 封装格式与内容要求**

**1. 请求格式**

请求体必须是一个合法的 JSON 对象，包含以下字段：
- **`messages`**（必需）：消息数组，每个消息是一个对象，包含：
  - `role`：角色（如 `"user"` 或 `"assistant"`）。
  - `content`：消息内容（字符串）。
- **`stream`**（可选）：布尔值，表示是否启用流式响应（默认为 `false`）。
- **`model`**（可选）：字符串，指定模型名称（如 `"gpt-3.5-turbo"`）。

**示例请求**：
```json
{
    "messages": [
        {"role": "user", "content": "你好！"},
        {"role": "assistant", "content": "你好，有什么可以帮您？"},
        {"role": "user", "content": "今天天气怎么样？"}
    ],
    "stream": false,
    "model": "gpt-3.5-turbo"
}
```

**2. 响应格式**

响应是一个 JSON 对象，包含以下字段：
- **成功响应**：
  - **`id`**：对话的唯一标识符（字符串）。
  - **`object`**：固定为 `"chat.completion"`。
  - **`created`**：生成时间戳（整数）。
  - **`model`**：使用的模型名称（字符串）。
  - **`choices`**：数组，每个元素包含：
    - `index`：消息索引（整数）。
    - `message`：助手的回复消息（`role` 和 `content`）。
    - `finish_reason`：固定为 `"stop"`。
  - **`usage`**：令牌统计：
    - `prompt_tokens`：输入消息的估算令牌数。
    - `completion_tokens`：回复消息的估算令牌数。
    - `total_tokens`：总令牌数。

  **示例**：
  ```json
  {
      "id": "chatcmpl-123456",
      "object": "chat.completion",
      "created": 1630000000,
      "model": "gpt-3.5-turbo",
      "choices": [
          {
              "index": 0,
              "message": {
                  "role": "assistant",
                  "content": "今天天气晴朗，适合外出。"
              },
              "finish_reason": "stop"
          }
      ],
      "usage": {
          "prompt_tokens": 10,
          "completion_tokens": 8,
          "total_tokens": 18
      }
  }
  ```

- **错误响应**：
  - **`error`**：对象，包含：
    - `message`：错误描述（字符串）。
    - `type`：错误类型（如 `"internal_error"` 或 `"invalid_request_error"`）。

  **示例**：
  - 助手不可用：
    ```json
    {
        "error": {
            "message": "Assistant not available",
            "type": "internal_error"
        }
    }
    ```
  - 无效请求：
    ```json
    {
        "error": {
            "message": "Missing or invalid messages field",
            "type": "invalid_request_error"
        }
    }
    ```

---

### handleOpenAIModels

```cpp
HttpResponse HttpServer::handleOpenAIModels(const HttpRequest& /* request */) { }
```

**函数功能解析**

`HttpServer::handleOpenAIModels` 是一个处理 HTTP API 请求的函数，主要用于模拟 OpenAI 的模型列表接口（类似 OpenAI 的 `/v1/models` 端点）。以下是其核心功能：

1. **返回模型列表**：
   - 生成一个 JSON 响应，包含当前支持的 AI 模型列表。
   - 默认添加一个模型 `"gpt-3.5-turbo"`，并附带其元信息（如创建时间、所有者等）。

2. **兼容 OpenAI 格式**：
   - 响应的 JSON 结构与 OpenAI 的模型列表接口保持一致，便于客户端直接使用。

3. **无请求参数**：
   - 该接口是只读的，无需任何输入参数（`HttpRequest& /* request */` 被注释掉）。

**JSON 封装格式与内容要求**

**1. 请求格式**

- 此接口不需要请求体，仅通过 HTTP GET 方法调用。

**2. 响应格式**

响应是一个 JSON 对象，包含以下字段：
- **`object`**：固定为 `"list"`，表示返回的是一个列表。
- **`data`**：模型数组，每个模型是一个对象，包含：
  - `id`：模型唯一标识符（字符串，如 `"gpt-3.5-turbo"`）。
  - `object`：固定为 `"model"`。
  - `created`：模型创建时间戳（整数）。
  - `owned_by`：模型所有者（字符串）。

**示例响应**：
```json
{
    "object": "list",
    "data": [
        {
            "id": "gpt-3.5-turbo",
            "object": "model",
            "created": 1630000000,
            "owned_by": "ai-assistant"
        }
    ]
}
```

---

### handleApiConversationMessages

```cpp
HttpResponse HttpServer::handleApiConversationMessages(const HttpRequest& request) { }
```

**函数功能解析**

`HttpServer::handleApiConversationMessages` 是一个处理 HTTP API 请求的函数，主要用于根据 `conversation_id` 查询指定对话的历史消息记录。以下是其核心功能：

1. **请求验证**：
   - 检查 AI 助手（`assistant_`）是否可用，如果不可用，返回 `500` 错误。
   - 从请求的查询参数（`query_params`）中提取 `conversation_id`，如果未提供则返回 `400` 错误。

2. **数据加载**：
   - 调用 `assistant_->loadConversation(conversation_id)` 从数据库加载指定对话。
   - 如果对话不存在，返回 `404` 错误。

3. **消息转换**：
   - 调用 `assistant_->getCurrentConversationHistory()` 获取对话的历史消息。
   - 将每条消息转换为 JSON 格式，包含角色（`role`）、内容（`content`）和时间戳（`timestamp`）。

4. **响应封装**：
   - 返回的 JSON 结构包含 `conversation_id` 和消息数组 `messages`。

5. **错误处理**：
   - 捕获异常并返回 `500` 错误，附带详细的错误信息。

**JSON 封装格式与内容要求**

**1. 请求格式**

- **请求方法**：HTTP GET。
- **查询参数**：
  - `conversation_id`（必需）：字符串，指定要查询的对话 ID。

**示例请求**：
```plaintext
GET /api/conversation/messages?conversation_id=12345
```

**2. 响应格式**

- **成功响应**：
  - **`conversation_id`**：查询的对话 ID（字符串）。
  - **`messages`**：消息数组，每个消息包含：
    - `role`：消息发送者角色（如 `"user"` 或 `"assistant"`）。
    - `content`：消息内容（字符串）。
    - `timestamp`：消息时间戳（Unix 时间戳，单位为秒）。

  **示例**：
  ```json
  {
      "conversation_id": "12345",
      "messages": [
          {
              "role": "user",
              "content": "你好！",
              "timestamp": 1630000000
          },
          {
              "role": "assistant",
              "content": "你好，有什么可以帮您？",
              "timestamp": 1630000005
          }
      ]
  }
  ```

- **错误响应**：
  - **`error`**：错误描述（字符串）。

  **示例**：
  - 缺少参数：
    ```json
    {
        "error": "conversation_id parameter is required"
    }
    ```
  - 对话不存在：
    ```json
    {
        "error": "Conversation not found"
    }
    ```
  - 服务器错误：
    ```json
    {
        "error": "Failed to get conversation messages: Database connection failed"
    }
    ```

---

