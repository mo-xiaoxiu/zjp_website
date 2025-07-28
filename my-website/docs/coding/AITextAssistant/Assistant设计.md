# Assistant设计

我来为您绘制 Assistant 的详细类图和处理流程图。

## 1. Assistant 类图

```mermaid
classDiagram
    class TextAssistant {
        -unique_ptr~ConfigManager~ config_manager_
        -unique_ptr~LLMClient~ llm_client_
        -unique_ptr~ConversationDB~ database_
        -atomic~bool~ initialized_
        -atomic~AssistantState~ current_state_
        -AssistantConfig assistant_config_
        -ConversationId current_conversation_id_
        -vector~Message~ conversation_history_
        -mutex conversation_mutex_
        -AssistantEventCallback event_callback_
        -string config_file_path_
        
        +TextAssistant(string config_file)
        +~TextAssistant()
        +bool initialize()
        +bool isInitialized() bool
        +bool loadConfig(string config_file)
        +bool saveConfig(string config_file) const
        +void setAssistantConfig(AssistantConfig config)
        +const AssistantConfig& getAssistantConfig() const
        +string startNewConversation(string title)
        +bool loadConversation(ConversationId conversation_id)
        +bool saveCurrentConversation()
        +vector~Conversation~ getRecentConversations(int limit)
        +bool deleteConversation(ConversationId conversation_id)
        +string processTextInput(string input)
        +string getCurrentConversationId() const
        +vector~Message~ getCurrentConversationHistory() const
        +AssistantState getState() const
        +void setState(AssistantState state)
        +void setEventCallback(AssistantEventCallback callback)
        +bool setLLMProvider(LLMConfig config)
        +void clearConversationHistory()
        +string getSystemInfo() const
        +bool testConnections()
        +void setSystemPrompt(string prompt)
        +string getSystemPrompt() const
        +bool loadPromptTemplate(string template_name)
        +int getTotalConversations() const
        +int getTotalMessages() const
        
        -void initializeComponents()
        -bool validateConfiguration()
        -string generateResponse(string user_input)
        -string buildPromptWithContext(string user_input)
        -void addMessageToHistory(Message message)
        -void trimConversationHistory()
        -void fireEvent(AssistantEvent event, string data)
        -void handleError(string error_message)
        -string generateConversationTitle(string first_message)
        -bool updateConversationInDatabase()
    }

    class ConfigManager {
        +loadConfig(string config_file) bool
        +saveConfig(string config_file) bool
        +getAppConfig() AppConfig
        +getPromptConfig() PromptConfig
        +setLLMConfig(LLMConfig config)
        +setPromptConfig(PromptConfig config)
        +loadPromptTemplate(string template_name) bool
        +expandTemplate(string template, map variables) string
    }

    class LLMClient {
        +chatCompletion(vector~Message~ messages) LLMResponse
        +streamChatCompletion(vector~Message~ messages, function callback)
        +updateConfig(LLMConfig config)
        +static createClient(LLMConfig config) unique_ptr
    }

    class ConversationDB {
        +initialize() bool
        +isInitialized() bool
        +createConversation(string title) ConversationId
        +getConversation(ConversationId id) optional~Conversation~
        +getRecentConversations(int limit) vector~Conversation~
        +deleteConversation(ConversationId id) bool
        +addMessage(ConversationId id, Message message)
        +updateConversationTitle(ConversationId id, string title)
        +getConversationCount() int
        +getMessageCount() int
    }

    class AssistantConfig {
        +bool auto_save_conversations
        +double response_timeout
        +int max_conversation_history
    }

    class AssistantState {
        <<enumeration>>
        IDLE
        PROCESSING
        ERROR
    }

    class AssistantEvent {
        <<enumeration>>
        STATE_CHANGED
        RESPONSE_GENERATED
        ERROR_OCCURRED
    }

    class Message {
        +string role
        +string content
        +ConversationId conversation_id
        +time_point timestamp
    }

    class Conversation {
        +ConversationId id
        +string title
        +vector~Message~ messages
        +time_point created_at
        +time_point updated_at
    }

    TextAssistant *-- ConfigManager
    TextAssistant *-- LLMClient
    TextAssistant *-- ConversationDB
    TextAssistant *-- AssistantConfig
    TextAssistant *-- AssistantState
    TextAssistant *-- AssistantEvent
    TextAssistant *-- Message
    TextAssistant *-- Conversation
    Conversation *-- Message
```

## 2. Assistant 初始化流程图

```mermaid
flowchart TD
    A["创建 TextAssistant"] --> B["构造函数初始化"]
    B --> C["设置默认配置"]
    C --> D["调用 initialize()"]
    D --> E["创建 ConfigManager"]
    E --> F{"配置文件存在?"}
    F -->|是| G["加载配置文件"]
    F -->|否| H["使用默认配置"]
    G --> I["验证配置"]
    H --> I
    I --> J{"配置验证通过?"}
    J -->|否| K["返回 false"]
    J -->|是| L["调用 initializeComponents"]
    L --> M["初始化数据库"]
    M --> N{"数据库初始化成功?"}
    N -->|否| O["抛出异常"]
    N -->|是| P["创建 LLM 客户端"]
    P --> Q{"LLM 客户端创建成功?"}
    Q -->|否| R["抛出异常"]
    Q -->|是| S["设置状态为 IDLE"]
    S --> T["设置 initialized_ = true"]
    T --> U["返回 true"]
```

## 3. 文本处理流程图

```mermaid
flowchart TD
    A[调用 processTextInput] --> B{已初始化?}
    B -->|否| C[返回错误消息]
    B -->|是| D[设置状态为 PROCESSING]
    D --> E[添加用户消息到历史]
    E --> F[调用 generateResponse]
    F --> G[构建带上下文的提示词]
    G --> H[准备消息数组]
    H --> I[添加系统消息]
    I --> J[添加对话历史]
    J --> K[添加用户输入]
    K --> L[调用 LLM 客户端]
    L --> M{LLM 响应成功?}
    M -->|否| N[返回错误消息]
    M -->|是| O[添加助手响应到历史]
    O --> P[设置状态为 IDLE]
    P --> Q[触发响应生成事件]
    Q --> R[返回响应内容]
```

## 4. 对话管理流程图

```mermaid
flowchart TD
    A[开始新对话] --> B{数据库已初始化?}
    B -->|否| C[返回空字符串]
    B -->|是| D[获取互斥锁]
    D --> E{当前有对话?}
    E -->|是| F[保存当前对话]
    E -->|否| G[创建新对话]
    F --> G
    G --> H[清空对话历史]
    H --> I[触发状态变更事件]
    I --> J[返回对话 ID]
    
    K[加载对话] --> L{数据库已初始化?}
    L -->|否| M[返回 false]
    L -->|是| N[获取互斥锁]
    N --> O[从数据库获取对话]
    O --> P{对话存在?}
    P -->|否| Q[返回 false]
    P -->|是| R[保存当前对话]
    R --> S[设置当前对话 ID]
    S --> T[加载对话历史]
    T --> U[返回 true]
    
    V[保存对话] --> W{对话 ID 为空?}
    W -->|是| X[返回 false]
    W -->|否| Y[获取互斥锁]
    Y --> Z[更新数据库中的对话]
    Z --> AA[返回更新结果]
```

## 5. 消息处理详细流程图

```mermaid
flowchart TD
    A[generateResponse] --> B{LLM 客户端可用?}
    B -->|否| C[返回错误消息]
    B -->|是| D[buildPromptWithContext]
    D --> E[获取提示词配置]
    E --> F[构建对话历史上下文]
    F --> G[展开模板变量]
    G --> H[准备消息数组]
    H --> I[添加系统消息]
    I --> J[添加历史消息]
    J --> K[添加用户输入]
    K --> L[调用 LLM chatCompletion]
    L --> M{响应成功?}
    M -->|否| N[记录错误并返回错误消息]
    M -->|是| O[返回响应内容]
    
    subgraph "addMessageToHistory"
        P[添加消息到历史] --> Q[获取互斥锁]
        Q --> R[设置对话 ID 和时间戳]
        R --> S[添加到历史数组]
        S --> T{自动保存启用?}
        T -->|是| U[添加到数据库]
        T -->|否| V[跳过数据库操作]
        U --> W[trimConversationHistory]
        V --> W
        W --> X[释放互斥锁]
    end
```

## 6. 事件处理流程图

```mermaid
flowchart TD
    A[状态变更] --> B[setState]
    B --> C[更新 current_state_]
    C --> D[转换状态为字符串]
    D --> E[fireEvent STATE_CHANGED]
    
    F[响应生成] --> G[processTextInput 完成]
    G --> H[fireEvent RESPONSE_GENERATED]
    
    I[错误发生] --> J[捕获异常]
    J --> K[handleError]
    K --> L[记录错误日志]
    L --> M[setState ERROR]
    M --> N[fireEvent ERROR_OCCURRED]
    
    O[fireEvent] --> P{回调函数已设置?}
    P -->|否| Q[忽略事件]
    P -->|是| R[调用回调函数]
    R --> S[传递事件类型和数据]
```

## 7. 配置管理流程图

```mermaid
flowchart TD
    A[加载配置] --> B{ConfigManager 已初始化?}
    B -->|否| C[返回 false]
    B -->|是| D[更新配置文件路径]
    D --> E[调用 ConfigManager::loadConfig]
    E --> F[返回加载结果]
    
    G[保存配置] --> H{ConfigManager 已初始化?}
    H -->|否| I[返回 false]
    H -->|是| J[确定文件路径]
    J --> K[调用 ConfigManager::saveConfig]
    K --> L[返回保存结果]
    
    M[设置 LLM 提供商] --> N{ConfigManager 可用?}
    N -->|否| O[返回 false]
    N -->|是| P[更新 LLM 配置]
    P --> Q[重新创建 LLM 客户端]
    Q --> R{创建成功?}
    R -->|否| S[记录错误并返回 false]
    R -->|是| T[记录成功并返回 true]
```

## 8. 数据流图

```mermaid
flowchart LR
    A[用户输入] --> B[TextAssistant::processTextInput]
    B --> C[Message 对象]
    C --> D[addMessageToHistory]
    D --> E[conversation_history_]
    E --> F[generateResponse]
    F --> G[buildPromptWithContext]
    G --> H[LLMClient::chatCompletion]
    H --> I[LLMResponse]
    I --> J[Message 对象]
    J --> K[addMessageToHistory]
    K --> L[conversation_history_]
    L --> M[返回响应]
    
    subgraph "配置数据流"
        N[ConfigManager] --> O[LLMConfig]
        O --> P[LLMClient]
        N --> Q[PromptConfig]
        Q --> R[提示词构建]
    end
    
    subgraph "数据库数据流"
        S[ConversationDB] --> T[Conversation]
        T --> U[Message]
        U --> V[conversation_history_]
    end
```

## 总结

1. **核心组件**：
   - `ConfigManager`：管理配置
   - `LLMClient`：处理 LLM 请求
   - `ConversationDB`：管理对话数据

2. **状态管理**：
   - 使用原子变量管理初始化状态
   - **状态机**管理助手状态
   - 事件回调机制

3. **线程安全**：
   - 使用互斥锁保护对话历史
   - 原子变量管理状态

4. **错误处理**：
   - 完整的异常处理机制
   - 错误事件通知
   - 错误事件恢复

5. **扩展性**：
   - 事件驱动架构
   - 可配置的提示词模板
   - 支持多种 LLM 提供商

