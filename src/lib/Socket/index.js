import {SocketMessage} from './SocketMessage';
import SocketEvent from './SocketEvent';

export default class Socket extends SocketEvent {
    count = 0;
    option = {
        protocol: 'ws',
        host: '',
        path: '',
        url: '',
        maxConnectCount: 5,
        query: {}
    };
    socket = {};

    constructor(option) {
        super();
        this.option = Object.assign(this.option, option);

        if (/\/$/g.test(this.option.host)) {
            this.option.host = this.option.host.substring(0, this.option.host.length - 1);
        }
        if (!/^\//g.test(this.option.path)) {
            this.option.path = '/' + this.option.path;
        }
        this.option.url = this.option.protocol + '://' + this.option.host + this.option.path;

        let query = '';
        const queryKeys = Object.keys(this.option.query);
        if (this.option.query && (typeof this.option.query) === 'object' && queryKeys.length > 0) {
            query = '?';
            queryKeys.forEach((key, i) => {
                query += `${key}=${this.option.query[key]}`;
                if (i + 1 !== queryKeys.length) {
                    query += '&';
                }
            });
        }
        this.option.url = this.option.url + query;
    }

    reconnect(option) {
        const maximum = this.option.maxConnectCount || 1;

        if (this.count >= maximum) {
            console.warn('websocket 无法正确连接，请检查链接地址、网络或服务器');
            return null;
        }
        console.log('正在重连...');
        this.socket = new WebSocket(option.url);
        this.addEvent(this.socket);
        this.socket.onopen = () => {
            console.log('%cwebsocket 已重新连接', 'font-size:14px;color:#87d068;');
        };
        return this.socket;
    }

    connect() {
        const option = this.option;
        option.url = (option.url && (/^ws:\/\//g.test(option.url) || /^wss:\/\//g.test(option.url))) ? option.url : '';
        if (!option.url) {
            throw new Error('websocket 链接不合法');
        }

        this.socket = new WebSocket(option.url);
        console.info('%cwebsocket 连接中...', 'font-size:14px;color:#147ff4;');
        this.addEvent(this.socket);
        return this.socket;
    }

    addEvent(webSocket) {

        //成功连接
        webSocket.addEventListener('open', (event) => {
            console.log('%cwebsocket 已连接', 'font-size:14px;color:#87d068;');
            // webSocket.emit('HEART_BEAT');
        });

        //连接已关闭
        webSocket.addEventListener('close', (event) => {
            console.info('%cwebsocket 连接已关闭', 'font-size:14px;color:#147ff4;');
        });

        //发送错误
        webSocket.addEventListener('error', (event) => {
            console.error('%cwebsocket 发生错误', 'font-size:14px', event);
            console.log('%c正在尝试重新连接...', 'font-size:14px');
            this.count++;
            webSocket = this.reconnect(this.option);
        });

        //监听消息
        webSocket.addEventListener('message', (event) => {
            const message = event.data || '{"type": ""}';
            let socketMessage = {};
            try {
                socketMessage = JSON.parse(message);
            } catch (e) {
                console.warn('数据解析错误: ', e);
                socketMessage = {type: message};
            }
            if (!socketMessage.type) {
                socketMessage.type = '';
            }
            this.trigger(socketMessage);
        });

        //socket 封装发送方法
        webSocket.emit = (eventName, data) => {
            data = data || {};
            const socketMessage = new SocketMessage(eventName, data);
            let message = '';
            try {
                message = JSON.stringify(socketMessage);
            } catch (e) {
                console.warn('数据序列化错误: ', e);
                message = data;
            }
            if (webSocket && webSocket.readyState !== WebSocket.CLOSED) {
                const interval = setInterval(() => {
                    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
                        webSocket.send(message);
                        clearInterval(interval);
                    } else if (webSocket && webSocket.readyState === WebSocket.CLOSED) {
                        clearInterval(interval);
                    }
                }, 0);
            } else {
                this.count = 0;
                webSocket = this.reconnect(this.option);
            }
        };

        //socket 封装监听方法
        webSocket.on = (eventName, foo) => {
            this.listen(eventName, foo);
        };

        //socket 封装移除方法
        webSocket.off = (eventName, foo) => {
            this.remove(eventName, foo);
        };

        //页面卸载时主动断开连接
        window.addEventListener('unload', function (e) {
            //这里不能有浏览器阻塞操作
            webSocket.close();
        });

        //网络离线时
        window.addEventListener('offline', e => {
            if (webSocket) {
                if (webSocket.readyState !== WebSocket.OPEN) {
                    return;
                }
                webSocket.close();
            }
        });

        //网络连接时
        window.addEventListener('online', e => {
            if (webSocket) {
                if (webSocket.readyState === WebSocket.OPEN) {
                    webSocket.emit('HEART_BEAT');
                    return;
                }
                webSocket.close();
            }
            webSocket = this.reconnect(this.option);
        });

    }
}
