# gdbus小记

GDBus 是 GLib 库提供的高层 D-Bus 进程间通信（IPC）实现框架。

GDbus通信有几个概念：

* 总线：分为系统总线和会话总线
  * 系统总线用于传输系统级别权限的消息，用户权限级别的进程也可以接入，但一般不能往上面发送消息，因为需要更高的权限；
  * 实际项目上用的是会话总线，会话总线是一个用户创建一个
* dbus通信是分为客户端和服务端，提供对应服务的为服务端，接收和使用对应服务的为客户端，服务端和客户端都需要接入到对应的总线上才能收发消息，当服务端有数据变化需要广播到总线上时，则会以消息的形式发送到总线上，客户端则是通过接收对应消息的方式获取服务等
* 对象和对象路径的概念：在dbus中，对象也称之为实例，每个客户端或服务端可以是一个用于进程的应用程序，每个进程可以有多个实例，实例可以说是dbus通信的端点，客户端和服务端的消息收发都是通过找到对应的实例进行发送；在总线上，获取实例需要直到实例路径，类似于网络世界的域名和端口
* 接口：消息发往客户端或服务端的实例之后会根据不同的接口进行消息处理，接口分为信号和方法
  * 信号是当服务端有某些数据变化需要通知给关注该数据的客户端的时候定义；
  * 方法是客户端可以在需要的时候通过发送消息给到服务端调用服务端的某个方法完成对关注数据的处理，服务端在处理完成之后会再次通过消息的形式发送给客户端，客户端得到接口后对数据进行处理

以下使用开源的git示例仓库作为客户端和服务端编程的说明。

github地址：

```shell
https://github.com/Pedal2Metal/GDBus
```

使用git clone之后按照如下方式进行编译：

```shell
mkdir build
cd build/
cmake ../
make
```

目录结构如下：

```shell
.
├── client
│   ├── client.c
│   └── CMakeLists.txt
├── CMakeLists.txt
├── gdbus
│   ├── CMakeLists.txt
│   └── Interface.xml
├── includes
│   ├── client.h
│   ├── gdbusCommon.h
│   └── server.h
├── README.md
└── server
    ├── CMakeLists.txt
    └── server.c

5 directories, 11 files
```

## 前提

GDbus使用XML格式的配置文件对接口进行定义，如下为上面git示例参考的接口文件配置：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<node>
  <interface name="com.gdbus.demo">
    <method name="SetName">
      <arg name="name" type="s" direction="in"/>
      <arg name="response" type="s" direction="out"/>
    </method>
    <signal name="SendSignal">
      <arg name="sig" type="i"/>
    </signal>
  </interface>
</node>
```

* 接口名：点分隔开，形式很像域名
  * method方法：方法名为`SetName`，有两个参数，参数名为`name`为入参，参数类型为字符串；参数名为`response`为出参，类型也为字符串；入参表示和出参都为调用者（比如客户端）调用时传入，入参为调用该method的必须参数，出参为method的调用接口，最终需要客户端接收处理
  * signal信号：信号名为`SendSignal`，参数名为`sig`，参数类型为整形，信号表示服务端外发数据，所以是没有参数方向的，调用时最终需要客户端接收处理

再看下gdbus文件夹下的`CMakeLists.txt`：

```cmake
CMAKE_MINIMUM_REQUIRED (VERSION 2.8.10)

EXECUTE_PROCESS(COMMAND gdbus-codegen --generate-c-code ${PROJECT_SOURCE_DIR}/gdbus/gdbusdemo_gen ${PROJECT_SOURCE_DIR}/gdbus/Interface.xml)  
```

* 执行指令：`gdbus-codegen --generate-c-code ${PROJECT_SOURCE_DIR}/gdbus/gdbusdemo_gen ${PROJECT_SOURCE_DIR}/gdbus/Interface.xml`

  * `gdbus-codegen`自动生成**服务端骨架**和**客户端代理**代码，减少手动解析消息的复杂度，这里时解析gdbus文件夹下的XML配置文件，并把文件名指定为`gdbusdemo_gen`

* 执行cmake和make之后将会生成如下文件：

  ```shell
  gdbus/
  ├── CMakeLists.txt
  ├── gdbusdemo_gen.c
  ├── gdbusdemo_gen.h
  └── Interface.xml
  
  1 directory, 4 files
  ```



## 服务端编程

<img src="https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250309101226.png"  />

```cpp
#include "server.h"
#include "gdbusCommon.h"

static GMainLoop *pLoop = NULL;
static ComGdbusDemo *pSkeleton = NULL;

static gboolean sendSignal(gconstpointer p);
static gboolean setName(ComGdbusDemo *object, GDBusMethodInvocation *invocation, const gchar *in_arg, gpointer user_data);
static void *run(void* arg);

static void GBusAcquired_Callback(GDBusConnection *connection,
                         const gchar *name,
                         gpointer user_data);
static void GBusNameAcquired_Callback (GDBusConnection *connection,
                             const gchar *name,
                             gpointer user_data);
static void GBusNameLost_Callback (GDBusConnection *connection,
                         const gchar *name,
                         gpointer user_data);

static gboolean sendSignal(gconstpointer p)          
{                                                         
    g_print("Server sendSignal is called.\n");            

    gint sig = 6;
    com_gdbus_demo_emit_send_signal (pSkeleton,sig);

    return TRUE;                                          
} 

static gboolean setName(ComGdbusDemo *object,
                           GDBusMethodInvocation *invocation,
                           const gchar           *in_arg,
                           gpointer               user_data)
{
    g_print("Server setName is call. Name is : %s.\n", in_arg);

    in_arg = "Set Name Success";

    com_gdbus_demo_complete_set_name(object, invocation, in_arg);

    return TRUE;
}

static void *run(void* arg)
{
    g_main_loop_run(pLoop);
}

static void GBusAcquired_Callback(GDBusConnection *connection,
                         const gchar *name,
                         gpointer user_data){
    
    GError *pError = NULL;

    pSkeleton = com_gdbus_demo_skeleton_new();

    (void) g_signal_connect(pSkeleton, "handle-set-name", G_CALLBACK(setName), NULL);

    (void) g_dbus_interface_skeleton_export(G_DBUS_INTERFACE_SKELETON(pSkeleton),
                                                connection,
                                                COM_GDBUS_DEMO_OBJECT_PATH,
                                                &pError);

    if(pError == 0){
        g_print("skeleton export successfully. \n");
    }else{
        g_print("Error: Failed to export object. Reason: %s.\n", pError->message);
        g_error_free(pError);
        g_main_loop_quit(pLoop);
        return;
    }
}

static void GBusNameAcquired_Callback (GDBusConnection *connection,
                             const gchar *name,
                             gpointer user_data){
    g_print("GBusNameAcquired_Callback, Acquired bus name: %s \n", COM_GDBUS_DEMO_NAME);
}

static void GBusNameLost_Callback (GDBusConnection *connection,
                         const gchar *name,
                         gpointer user_data){
    if (connection == NULL)
    {
        g_print("GBusNameLost_Callback, Error: Failed to connect to dbus. \n");
    }else{
        g_print("GBusNameLost_Callback, Error: Failed to get dbus name : %s\n", COM_GDBUS_DEMO_NAME);
}
    g_main_loop_quit(pLoop);
}

bool initDBusCommunicationForServer(void){
    
    bool bRet = TRUE;

    pLoop = g_main_loop_new(NULL,FALSE); 

    guint own_id = 
        g_bus_own_name (COM_GDBUS_DEMO_BUS,
                    COM_GDBUS_DEMO_NAME,
                    G_BUS_NAME_OWNER_FLAGS_NONE,
                    &GBusAcquired_Callback,
                    &GBusNameAcquired_Callback,
                    &GBusNameLost_Callback,
                    NULL,
                    NULL);

    g_timeout_add(2000, (GSourceFunc)sendSignal, NULL);

    return bRet;
}


int main(){

    pthread_t tid;
    
    initDBusCommunicationForServer();

    pthread_create(&tid, NULL, run, NULL);

    while(1){
	    /* code */
    }
    return 0;
}
```

* `g_main_loop_new`创建main loop，用于事件循环，接发总线上的消息
* `g_bus_own_name`获取总线名，连接到会话总线上，指定对象名，绑定回调
  * `GBusAcquired_Callback`获取总线连接之后的处理
  * `GBusNameAcquired_Callback`获取总线名之后的处理
  * `GBusNameLost_Callback`总线名丢失之后的处理：可以理解为断开总线连接了
* `g_timeout_add`信号发送，这里的周期是2s调用`sendSignal`函数发送一次信号
  * `com_gdbus_demo_emit_send_signal`往总线上广播信号
* `com_gdbus_demo_skeleton_new`创建服务端骨架，用于绑定方法等接口
* `g_signal_connect`通过信号的方式将method的处理程序连接到骨架
  * `setName`method的处理程序，当客户端调用服务端的method方法时，等待服务端将处理逻辑做完需要调用`com_gdbus_demo_complete_set_name`表示**同步调用完成**
* `g_dbus_interface_skeleton_export`将骨架对应的接口导出到总线上，这样其他客户端就可以调用了
* `g_main_loop_run`开启main loop，开始收发总线上的消息
* `g_main_loop_quit`停止main loop

## 客户端编程

<img src="https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250309102628.png"  />

```cpp
#include "gdbusCommon.h"
#include "client.h"

static GMainLoop *pLoop = NULL;
static GDBusConnection *pConnection = NULL;
static ComGdbusDemo *pProxy = NULL;

static void setNameMethod(const gchar *in_arg, gchar** out_arg, GError** pError);
static gboolean sendSignalHandler(ComGdbusDemo *object, const gint *arg, gpointer userdata);
static void *run(void *arg);

static void setNameMethod(const gchar *in_arg, gchar** out_arg, GError** pError){
	
	com_gdbus_demo_call_set_name_sync (pProxy, in_arg, out_arg, NULL, pError);
	
	if (*pError == NULL) {
        g_print("Client setNameMethod is called, in_arg = %s out_arg = %s.\n", in_arg, *out_arg);
        g_free(*out_arg);
    } else {
        g_print("Failed to call setNameMethod. Reason: %s.\n", (*pError)->message);
        g_error_free(*pError);
    }
}

static gboolean sendSignalHandler(ComGdbusDemo *object, const gint *arg, gpointer userdata){
	 
	g_print("sendSignalHandler: Signal value: %d.\n", arg);

    return TRUE;
}

static void *run(void* arg)
{
    g_main_loop_run(pLoop);
}

bool initDBusCommunication(void){
	
	bool bRet = TRUE;
    GError *pConnError = NULL;
    GError *pProxyError = NULL;
	
	do{
		bRet = TRUE;
		pLoop = g_main_loop_new(NULL,FALSE); 
		
		pConnection = g_bus_get_sync(COM_GDBUS_DEMO_BUS, NULL, &pConnError);
		if(pConnError == NULL){
			pProxy = com_gdbus_demo_proxy_new_sync(pConnection,
						 G_DBUS_PROXY_FLAGS_NONE,
						 COM_GDBUS_DEMO_NAME,
						 COM_GDBUS_DEMO_OBJECT_PATH,
						 NULL,
						 &pProxyError);
			if(pProxy == 0){
				g_print("initDBusCommunication: Create proxy failed. Reason: %s.\n", pConnError->message);
				g_error_free(pProxyError);
				bRet = FALSE;
			}else{
				g_print("initDBusCommunication: Create proxy successfully. \n");
			}
		}else{
			g_print("initDBusCommunication: Failed to connect to dbus. Reason: %s.\n", pConnError->message);
            g_error_free(pConnError);
            bRet = FALSE;
		}
	}while(bRet == FALSE);
					 
	if(bRet == TRUE){
		g_signal_connect(pProxy, "send-signal", G_CALLBACK(sendSignalHandler), NULL);
	}else{
		g_print("initDBusCommunication: Failed to connect signal.  \n");
	}

	return bRet;
}

int main(void){

	pthread_t tid;
	
	const gchar *intputArg = "TODD";
    gchar *outputArg = NULL;
    GError *gMethoderror = NULL;

    initDBusCommunication();

    setNameMethod(intputArg, &outputArg, &gMethoderror);
    
	pthread_create(&tid,NULL,run,NULL);

    while (1)
	{
		/* code */
	}
	
    return 0;
}
```

* `g_main_loop_new`创建main loop，用于接发消息
* `g_bus_get_sync`获取对应的总线连接
* `com_gdbus_demo_proxy_new_sync`根据对象名和路径创建客户端代理
* `g_signal_connect`将客户端关注的信号对应的处理程序通过信号的方式连接到代理
  * `sendSignalHandler`如果服务端有对应的信号发送过来，如服务端调用`sendSignal`，则会进入这个函数处理
* `setNameMethod`最终会调用服务端提供的方法
  * `com_gdbus_demo_call_set_name_sync`调用服务端提供的method，为**同步调用**
  * `intputArg`为入参，是调用这个方法必要的参数；`outputArg`出参，是服务端将调用结果放入这个参数，返回给客户端处理

该git仓库的代码执行结果可以自行验证。

