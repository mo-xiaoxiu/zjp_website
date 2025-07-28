# LLM客户端设计

我来为您绘制 LLM 客户端的详细类图和处理流程图。

## 1. LLM 客户端类图

```mermaid
classDiagram
    class LLMClient {
        <<abstract>>
        #LLMConfig config_
        #unique_ptr~HTTPClient~ http_client_
        
        +LLMClient(LLMConfig config)
        +virtual ~LLMClient()
        +virtual LLMResponse chatCompletion(vector~Message~ messages)
        +virtual void streamChatCompletion(vector~Message~ messages, function~void(string)~ callback)
        +void updateConfig(LLMConfig config)
        +const LLMConfig& getConfig() const
        +static unique_ptr~LLMClient~ createClient(LLMConfig config)
        
        #virtual string buildRequestPayload(vector~Message~ messages) = 0
        #virtual LLMResponse parseResponse(HTTPResponse http_response) = 0
        #virtual map~string,string~ buildHeaders() = 0
    }

    class HTTPClient {
        -CURL* curl_
        
        +HTTPClient()
        +~HTTPClient()
        +HTTPResponse post(string url, string data, map~string,string~ headers)
        +HTTPResponse get(string url, map~string,string~ headers)
        +void setTimeout(long timeout_seconds)
        +void setUserAgent(string user_agent)
        
        -static size_t WriteCallback(void* contents, size_t size, size_t nmemb, string* userp)
        -static size_t HeaderCallback(void* contents, size_t size, size_t nmemb, map~string,string~* userp)
        -void setupCommonOptions()
        -struct curl_slist* buildHeaders(map~string,string~ headers)
    }

    class OpenAIClient {
        +explicit OpenAIClient(LLMConfig config)
        
        #string buildRequestPayload(vector~Message~ messages) override
        #LLMResponse parseResponse(HTTPResponse http_response) override
        #map~string,string~ buildHeaders() override
    }

    class AnthropicClient {
        +explicit AnthropicClient(LLMConfig config)
        
        #string buildRequestPayload(vector~Message~ messages) override
        #LLMResponse parseResponse(HTTPResponse http_response) override
        #map~string,string~ buildHeaders() override
    }

    class CustomClient {
        +explicit CustomClient(LLMConfig config)
        
        #string buildRequestPayload(vector~Message~ messages) override
        #LLMResponse parseResponse(HTTPResponse http_response) override
        #map~string,string~ buildHeaders() override
    }

    class HTTPResponse {
        +long status_code
        +string body
        +map~string,string~ headers
        +bool success
        +string error_message
    }

    class LLMResponse {
        +bool success
        +string content
        +string error_message
        +long status_code
        +map~string,string~ metadata
    }

    class LLMConfig {
        +string provider
        +string api_endpoint
        +string api_key
        +string model_name
        +float temperature
        +int max_tokens
        +map~string,string~ headers
    }

    class Message {
        +string role
        +string content
    }

    LLMClient <|-- OpenAIClient
    LLMClient <|-- AnthropicClient
    LLMClient <|-- CustomClient
    LLMClient *-- HTTPClient
    LLMClient *-- LLMConfig
    HTTPClient *-- HTTPResponse
    LLMClient ..> LLMResponse
    LLMClient ..> Message
```

## 2. LLM 客户端处理流程图

```mermaid
flowchart TD
    A[创建 LLMClient] --> B[选择提供商]
    B --> C{提供商类型}
    C -->|OpenAI| D[创建 OpenAIClient]
    C -->|Anthropic| E[创建 AnthropicClient]
    C -->|Custom| F[创建 CustomClient]
    
    D --> G[初始化 HTTPClient]
    E --> G
    F --> G
    
    G --> H[调用 chatCompletion]
    H --> I[构建请求载荷]
    I --> J[构建请求头]
    J --> K[发送 HTTP POST 请求]
    
    K --> L{HTTP 请求成功?}
    L -->|否| M[返回错误响应]
    L -->|是| N[解析响应]
    
    N --> O{解析成功?}
    O -->|否| P[返回解析错误]
    O -->|是| Q[提取响应内容]
    Q --> R[返回 LLMResponse]
    
    subgraph "OpenAI 处理流程"
        S[buildRequestPayload - OpenAI] --> T[构建 OpenAI 格式 JSON]
        T --> U[添加 model, temperature, max_tokens]
        U --> V[转换 messages 为 JSON 数组]
        V --> W[返回 JSON 字符串]
        
        X[parseResponse - OpenAI] --> Y[解析 JSON 响应]
        Y --> Z{包含 error?}
        Z -->|是| AA[返回错误信息]
        Z -->|否| BB[检查 choices 数组]
        BB --> CC[提取 message.content]
        CC --> DD[提取 usage 元数据]
        DD --> EE[返回 LLMResponse]
        
        FF[buildHeaders - OpenAI] --> GG[添加 Authorization: Bearer]
        GG --> HH[合并自定义头]
        HH --> II[返回头映射]
    end
    
    subgraph "Anthropic 处理流程"
        JJ[buildRequestPayload - Anthropic] --> KK[构建 Anthropic 格式 JSON]
        KK --> LL[分离 system 消息]
        LL --> MM[构建 messages 数组]
        MM --> NN[返回 JSON 字符串]
        
        OO[parseResponse - Anthropic] --> PP[解析 JSON 响应]
        PP --> QQ{包含 error?}
        QQ -->|是| RR[返回错误信息]
        QQ -->|否| SS[检查 content 数组]
        SS --> TT[提取 text 内容]
        TT --> UU[提取 usage 元数据]
        UU --> VV[返回 LLMResponse]
        
        WW[buildHeaders - Anthropic] --> XX[添加 x-api-key]
        XX --> YY[添加 anthropic-version]
        YY --> ZZ[合并自定义头]
        ZZ --> AAA[返回头映射]
    end
```

## 3. HTTP 客户端详细流程图

使用libcurl进行http的post请求：

```mermaid
flowchart TD
    A[HTTPClient 构造函数] --> B[初始化 CURL]
    B --> C[setupCommonOptions]
    C --> D[设置回调函数]
    D --> E[设置超时和用户代理]
    
    F[HTTP POST 请求] --> G{curl_ 已初始化?}
    G -->|否| H[返回错误响应]
    G -->|是| I[设置 URL 和 POST 数据]
    I --> J[设置回调数据指针]
    J --> K[构建请求头]
    K --> L[执行 curl_easy_perform]
    
    L --> M{CURL 执行成功?}
    M -->|否| N[返回 CURL 错误]
    M -->|是| O[获取响应状态码]
    O --> P[构建 HTTPResponse]
    P --> Q[判断成功状态]
    Q --> R[返回响应]
    
    subgraph "回调函数处理"
        S[WriteCallback] --> T[追加数据到响应体]
        T --> U[返回处理的数据大小]
        
        V[HeaderCallback] --> W[解析头字段]
        W --> X[去除空白字符]
        X --> Y[存储到头映射]
        Y --> Z[返回处理的数据大小]
    end
```

## 4. 工厂模式创建流程图

```mermaid
flowchart TD
    A["调用 createClient"] --> B["传入 LLMConfig"]
    B --> C["检查 provider 字段"]
    C --> D{"provider 类型"}
    D -->|openai| E["创建 OpenAIClient"]
    D -->|anthropic| F["创建 AnthropicClient"]
    D -->|其他| G["创建 CustomClient"]
    
    E --> H["返回 unique_ptr&lt;OpenAIClient&gt;"]
    F --> I["返回 unique_ptr&lt;AnthropicClient&gt;"]
    G --> J["返回 unique_ptr&lt;CustomClient&gt;"]
    
    H --> K["客户端准备就绪"]
    I --> K
    J --> K
```

## 5. 错误处理流程图

```mermaid
flowchart TD
    A[开始请求] --> B[构建请求载荷]
    B --> C{构建成功?}
    C -->|否| D[返回构建错误]
    C -->|是| E[发送 HTTP 请求]
    
    E --> F{HTTP 请求成功?}
    F -->|否| G[返回 HTTP 错误]
    F -->|是| H[解析 JSON 响应]
    
    H --> I{JSON 解析成功?}
    I -->|否| J[返回解析错误]
    I -->|是| K[检查响应格式]
    
    K --> L{包含错误信息?}
    L -->|是| M[返回 API 错误]
    L -->|否| N[提取响应内容]
    
    N --> O{内容提取成功?}
    O -->|否| P[返回内容错误]
    O -->|是| Q[返回成功响应]
    
    D --> R[错误处理完成]
    G --> R
    J --> R
    M --> R
    P --> R
    Q --> S[成功处理完成]
```

## 6. 数据流图

```mermaid
flowchart LR
    A[Message 数组] --> B[LLMClient::chatCompletion]
    B --> C[buildRequestPayload]
    C --> D[JSON 载荷字符串]
    D --> E[HTTPClient::post]
    E --> F[HTTP 请求]
    F --> G[服务器响应]
    G --> H[HTTPResponse 对象]
    H --> I[parseResponse]
    I --> J[LLMResponse 对象]
    J --> K[返回给调用者]
    
    subgraph "配置数据流"
        L[LLMConfig] --> M[LLMClient 构造函数]
        M --> N[存储配置]
        N --> O[用于构建请求]
    end
    
    subgraph "错误处理流"
        P[异常/错误] --> Q[错误处理]
        Q --> R[构建错误响应]
        R --> S[返回错误信息]
    end
```

## 主要特点总结：

1. **设计模式**：
   - 使用**工厂模式**创建不同提供商的客户端
   - 使用**模板方法**模式定义 LLM 客户端接口
2. **架构特点**：
   - 抽象基类 `LLMClient` 定义通用接口
   - 具体实现类处理不同提供商的特定格式
   - `HTTPClient` 封装 HTTP 通信细节
   - 统一的错误处理和响应格式
3. **扩展性**：
   - 易于添加新的 LLM 提供商
   - 支持自定义 API 端点
   - 灵活的配置管理
4. **错误处理**：
   - 多层错误检查和处理
   - 详细的错误信息返回
   - 异常安全的资源管理

