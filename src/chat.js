'use strict';

(function () {
    /*
     * Pod Chat Browser Module
     * @module chat
     *
     * @param {Object} params
     */
    var Async,
        ChatUtility,
        Dexie,
        KurentoUtils,
        WebrtcAdapter,
        Sentry;

    function Chat(params) {
        if (typeof (require) !== 'undefined' && typeof (exports) !== 'undefined') {
            Async = require('podasync-ws-only');
            ChatUtility = require('./utility/utility.js');
            Dexie = require('dexie').default || require('dexie');
            KurentoUtils = require('kurento-utils');
            WebrtcAdapter = require('webrtc-adapter');
            Sentry = require('@sentry/browser');
        } else {
            Async = window.POD.Async;
            ChatUtility = window.POD.ChatUtility;
            Dexie = window.Dexie;
            KurentoUtils = window.kurentoUtils;
            WebrtcAdapter = window.adapter;
            Sentry = window.Sentry;
        }

        /*******************************************************
         *          P R I V A T E   V A R I A B L E S          *
         *******************************************************/

        var Utility = new ChatUtility();

        if (!!Sentry) {
            Sentry.init({
                dsn: 'http://784a14966f6a416b8b58a4b144aef0f5@talksentry.sakku-khatam.ir:9000/4',
                attachStacktrace: true
            });
            Sentry.setContext("Chat Params", params);
        }

        var asyncClient,
            peerId,
            oldPeerId,
            userInfo,
            token = params.token,
            generalTypeCode = params.typeCode || 'default',
            mapApiKey = params.mapApiKey || '8b77db18704aa646ee5aaea13e7370f4f88b9e8c',
            deviceId,
            productEnv = (typeof navigator != 'undefined') ? navigator.product : 'undefined',
            db,
            queueDb,
            forceWaitQueueInMemory = (params.forceWaitQueueInMemory && typeof params.forceWaitQueueInMemory === 'boolean') ? params.forceWaitQueueInMemory : false,
            hasCache = productEnv !== 'ReactNative' && typeof Dexie != 'undefined',
            cacheInMemory = forceWaitQueueInMemory ? true : !hasCache,
            enableCache = (params.enableCache && typeof params.enableCache === 'boolean') ? params.enableCache : false,
            canUseCache = hasCache && enableCache,
            isCacheReady = false,
            cacheDeletingInProgress = false,
            cacheExpireTime = params.cacheExpireTime || 2 * 24 * 60 * 60 * 1000,
            cacheSecret = 'VjaaS9YxNdVVAd3cAsRPcU5FyxRcyyV6tG6bFGjjK5RV8JJjLrXNbS5zZxnqUT6Y',
            cacheSyncWorker,
            grantDeviceIdFromSSO = (params.grantDeviceIdFromSSO && typeof params.grantDeviceIdFromSSO === 'boolean')
                ? params.grantDeviceIdFromSSO
                : false,
            eventCallbacks = {
                connect: {},
                disconnect: {},
                reconnect: {},
                messageEvents: {},
                threadEvents: {},
                contactEvents: {},
                botEvents: {},
                userEvents: {},
                callEvents: {},
                fileUploadEvents: {},
                systemEvents: {},
                chatReady: {},
                error: {},
                chatState: {}
            },
            messagesCallbacks = {},
            messagesDelivery = {},
            messagesSeen = {},
            deliveryInterval,
            deliveryIntervalPitch = params.deliveryIntervalPitch || 2000,
            seenInterval,
            seenIntervalPitch = params.seenIntervalPitch || 2000,
            sendMessageCallbacks = {},
            threadCallbacks = {},
            getImageFromLinkObjects = {},
            asyncRequestTimeouts = {},
            chatMessageVOTypes = {
                CREATE_THREAD: 1,
                MESSAGE: 2,
                SENT: 3,
                DELIVERY: 4,
                SEEN: 5,
                PING: 6,
                BLOCK: 7,
                UNBLOCK: 8,
                LEAVE_THREAD: 9,
                ADD_PARTICIPANT: 11,
                GET_STATUS: 12,
                GET_CONTACTS: 13,
                GET_THREADS: 14,
                GET_HISTORY: 15,
                CHANGE_TYPE: 16,
                REMOVED_FROM_THREAD: 17,
                REMOVE_PARTICIPANT: 18,
                MUTE_THREAD: 19,
                UNMUTE_THREAD: 20,
                UPDATE_THREAD_INFO: 21,
                FORWARD_MESSAGE: 22,
                USER_INFO: 23,
                USER_STATUS: 24,
                GET_BLOCKED: 25,
                RELATION_INFO: 26,
                THREAD_PARTICIPANTS: 27,
                EDIT_MESSAGE: 28,
                DELETE_MESSAGE: 29,
                THREAD_INFO_UPDATED: 30,
                LAST_SEEN_UPDATED: 31,
                GET_MESSAGE_DELEVERY_PARTICIPANTS: 32,
                GET_MESSAGE_SEEN_PARTICIPANTS: 33,
                IS_NAME_AVAILABLE: 34,
                JOIN_THREAD: 39,
                BOT_MESSAGE: 40,
                SPAM_PV_THREAD: 41,
                SET_ROLE_TO_USER: 42,
                REMOVE_ROLE_FROM_USER: 43,
                CLEAR_HISTORY: 44,
                SYSTEM_MESSAGE: 46,
                GET_NOT_SEEN_DURATION: 47,
                PIN_THREAD: 48,
                UNPIN_THREAD: 49,
                PIN_MESSAGE: 50,
                UNPIN_MESSAGE: 51,
                UPDATE_CHAT_PROFILE: 52,
                CHANGE_THREAD_PRIVACY: 53,
                GET_PARTICIPANT_ROLES: 54,
                GET_REPORT_REASONS: 56,
                REPORT_THREAD: 57,
                REPORT_USER: 58,
                REPORT_MESSAGE: 59,
                GET_CONTACT_NOT_SEEN_DURATION: 60,
                ALL_UNREAD_MESSAGE_COUNT: 61,
                CREATE_BOT: 62,
                DEFINE_BOT_COMMAND: 63,
                START_BOT: 64,
                STOP_BOT: 65,
                LAST_MESSAGE_DELETED: 66,
                LAST_MESSAGE_EDITED: 67,
                BOT_COMMANDS: 68,
                THREAD_ALL_BOTS: 69,
                CALL_REQUEST: 70,
                ACCEPT_CALL: 71,
                REJECT_CALL: 72,
                RECIVE_CALL_REQUEST: 73,
                START_CALL: 74,
                END_CALL_REQUEST: 75,
                END_CALL: 76,
                GET_CALLS: 77,
                RECONNECT: 78,
                CONNECT: 79,
                CONTACT_SYNCED: 90,
                GROUP_CALL_REQUEST: 91,
                LEAVE_CALL: 92,
                ADD_CALL_PARTICIPANT: 93,
                CALL_PARTICIPANT_JOINED: 94,
                REMOVE_CALL_PARTICIPANT: 95,
                TERMINATE_CALL: 96,
                MUTE_CALL_PARTICIPANT: 97,
                UNMUTE_CALL_PARTICIPANT: 98,
                LOGOUT: 100,
                LOCATION_PING: 101,
                CLOSE_THREAD: 102,
                REMOVE_BOT_COMMANDS: 104,
                SEARCH: 105,
                CONTINUE_SEARCH: 106,
                REGISTER_ASSISTANT: 107,
                DEACTIVATE_ASSISTANT: 108,
                GET_ASSISTANTS: 109,
                ACTIVE_CALL_PARTICIPANTS: 110,
                CALL_SESSION_CREATED: 111,
                IS_BOT_NAME_AVAILABLE: 112,
                TURN_ON_VIDEO_CALL: 113,
                TURN_OFF_VIDEO_CALL: 114,
                ASSISTANT_HISTORY: 115,
                BLOCK_ASSISTANT: 116,
                UNBLOCK_ASSISTANT: 117,
                BLOCKED_ASSISTANTS: 118,
                RECORD_CALL: 121,
                END_RECORD_CALL: 122,
                START_SCREEN_SHARE: 123,
                END_SCREEN_SHARE: 124,
                DELETE_FROM_CALL_HISTORY: 125,
                MUTUAL_GROUPS: 130,
                CREATE_TAG: 140,
                EDIT_TAG: 141,
                DELETE_TAG: 142,
                ADD_TAG_PARTICIPANT: 143,
                REMOVE_TAG_PARTICIPANT: 144,
                GET_TAG_LIST: 145,
                DELETE_MESSAGE_THREAD: 151,
                ERROR: 999
            },
            inviteeVOidTypes = {
                TO_BE_USER_SSO_ID: 1,
                TO_BE_USER_CONTACT_ID: 2,
                TO_BE_USER_CELLPHONE_NUMBER: 3,
                TO_BE_USER_USERNAME: 4,
                TO_BE_USER_ID: 5,
                TO_BE_CORE_USER_ID: 6
            },
            createThreadTypes = {
                NORMAL: 0x0,
                OWNER_GROUP: 0x1,
                PUBLIC_GROUP: 0x2,
                CHANNEL_GROUP: 0x4,
                CHANNEL: 0x8,
                NOTIFICATION_CHANNEL: 0x10,
                PUBLIC_THREAD: 0x20,
                PUBLIC_CHANNEL: 0x40,
                SELF: 0x80
            },
            chatMessageTypes = {
                TEXT: '1',
                VOICE: '2',
                PICTURE: '3',
                VIDEO: '4',
                SOUND: '5',
                FILE: '6',
                POD_SPACE_PICTURE: '7',
                POD_SPACE_VIDEO: '8',
                POD_SPACE_SOUND: '9',
                POD_SPACE_VOICE: '10',
                POD_SPACE_FILE: '11',
                LINK: '12',
                END_CALL: '13',
                START_CALL: '14',
                STICKER: '15'
            },
            assistantActionTypes = {
                REGISTER: 1,
                ACTIVATE: 2,
                DEACTIVATE: 3,
                BLOCK: 4
            },
            systemMessageTypes = {
                IS_TYPING: '1',
                RECORD_VOICE: '2',
                UPLOAD_PICTURE: '3',
                UPLOAD_VIDEO: '4',
                UPLOAD_SOUND: '5',
                UPLOAD_FILE: '6'
            },
            locationPingTypes = {
                'CHAT': 1,
                'THREAD': 2,
                'CONTACTS': 3
            },
            callTypes = {
                'VOICE': 0x0,
                'VIDEO': 0x1
            },
            callOptions = params.callOptions,
            callTurnIp = (params.callOptions
                && params.callOptions.hasOwnProperty('callTurnIp')
                && typeof params.callOptions.callTurnIp === 'string')
                ? params.callOptions.callTurnIp
                : '46.32.6.188',
            callDivId = (params.callOptions
                && params.callOptions.hasOwnProperty('callDivId')
                && typeof params.callOptions.callDivId === 'string')
                ? params.callOptions.callDivId
                : 'call-div',
            callAudioTagClassName = (params.callOptions
                && params.callOptions.hasOwnProperty('callAudioTagClassName')
                && typeof params.callOptions.callAudioTagClassName === 'string')
                ? params.callOptions.callAudioTagClassName
                : '',
            callVideoTagClassName = (params.callOptions
                && params.callOptions.hasOwnProperty('callVideoTagClassName')
                && typeof params.callOptions.callVideoTagClassName === 'string')
                ? params.callOptions.callVideoTagClassName
                : '',
            callVideoMinWidth = (params.callOptions
                && params.callOptions.hasOwnProperty('callVideo')
                && typeof params.callOptions.callVideo === 'object'
                && params.callOptions.callVideo.hasOwnProperty('minWidth'))
                ? params.callOptions.callVideo.minWidth
                : 320,
            callVideoMinHeight = (params.callOptions
                && params.callOptions.hasOwnProperty('callVideo')
                && typeof params.callOptions.callVideo === 'object'
                && params.callOptions.callVideo.hasOwnProperty('minHeight'))
                ? params.callOptions.callVideo.minHeight
                : 180,
            currentCallParams = {},
            currentCallId = null,
            shouldReconnectCallTimeout = null,
            callTopics = {},
            callWebSocket = null,
            callSocketForceReconnect = true,
            callClientType = {
                WEB: 1,
                ANDROID: 2,
                DESKTOP: 3
            },
            webpeers = {},
            uiRemoteMedias = {},
            systemMessageIntervalPitch = params.systemMessageIntervalPitch || 1000,
            isTypingInterval,
            protocol = params.protocol || 'websocket',
            queueHost = params.queueHost,
            queuePort = params.queuePort,
            queueUsername = params.queueUsername,
            queuePassword = params.queuePassword,
            queueReceive = params.queueReceive,
            queueSend = params.queueSend,
            queueConnectionTimeout = params.queueConnectionTimeout,
            socketAddress = params.socketAddress,
            serverName = params.serverName || '',
            callServerName,
            wsConnectionWaitTime = params.wsConnectionWaitTime,
            connectionRetryInterval = params.connectionRetryInterval,
            msgPriority = params.msgPriority || 1,
            messageTtl = params.messageTtl || 10000,
            reconnectOnClose = params.reconnectOnClose,
            asyncLogging = params.asyncLogging,
            chatPingMessageInterval = 20000,
            sendPingTimeout,
            getUserInfoTimeout,
            config = {
                getHistoryCount: 50
            },
            SERVICE_ADDRESSES = {
                SSO_ADDRESS: params.ssoHost || 'https://accounts.pod.ir',
                PLATFORM_ADDRESS: params.platformHost || 'https://api.pod.ir/srv/core',
                FILESERVER_ADDRESS: params.fileServer || 'https://core.pod.ir',
                PODSPACE_FILESERVER_ADDRESS: params.podSpaceFileServer || 'https://podspace.pod.ir',
                MAP_ADDRESS: params.mapServer || 'https://api.neshan.org/v2'
            },
            SERVICES_PATH = {
                // Grant Devices
                SSO_DEVICES: '/oauth2/grants/devices',
                SSO_GENERATE_KEY: '/handshake/users/',
                SSO_GET_KEY: '/handshake/keys/',
                // Contacts
                ADD_CONTACTS: '/nzh/addContacts',
                UPDATE_CONTACTS: '/nzh/updateContacts',
                REMOVE_CONTACTS: '/nzh/removeContacts',
                SEARCH_CONTACTS: '/nzh/listContacts',
                // File/Image Upload and Download
                UPLOAD_IMAGE: '/nzh/uploadImage',
                GET_IMAGE: '/nzh/image/',
                UPLOAD_FILE: '/nzh/uploadFile',
                GET_FILE: '/nzh/file/',
                // POD Drive Services
                PODSPACE_UPLOAD_FILE_TO_USERGROUP: '/userGroup/uploadFile',
                PODSPACE_UPLOAD_IMAGE_TO_USERGROUP: '/userGroup/uploadImage',
                PODSPACE_UPLOAD_FILE: '/nzh/drive/uploadFile',
                PODSPACE_UPLOAD_FILE_FROM_URL: '/nzh/drive/uploadFileFromUrl',
                PODSPACE_UPLOAD_IMAGE: '/nzh/drive/uploadImage',
                PODSPACE_DOWNLOAD_FILE: '/nzh/drive/downloadFile',
                PODSPACE_DOWNLOAD_IMAGE: '/nzh/drive/downloadImage',
                // Neshan Map
                REVERSE: '/reverse',
                SEARCH: '/search',
                ROUTING: '/routing',
                STATIC_IMAGE: '/static'
            },
            imageMimeTypes = [
                'image/bmp',
                'image/png',
                'image/tiff',
                'image/x-icon',
                'image/jpeg',
                'image/webp'
            ],
            imageExtentions = [
                'bmp',
                'png',
                'tiff',
                'tiff2',
                'ico',
                'jpg',
                'jpeg',
                'webp'
            ],
            CHAT_ERRORS = {
                // Socket Errors
                6000: 'No Active Device found for this Token!',
                6001: 'Invalid Token!',
                6002: 'User not found!',
                // Get User Info Errors
                6100: 'Cant get UserInfo!',
                6101: 'Getting User Info Retry Count exceeded 5 times; Connection Can Not Been Estabilished!',
                // Http Request Errors
                6200: 'Network Error',
                6201: 'URL is not clarified!',
                // File Uploads Errors
                6300: 'Error in uploading File!',
                6301: 'Not an image!',
                6302: 'No file has been selected!',
                6303: 'File upload has been canceled!',
                6304: 'User Group Hash is needed for file sharing!',
                // Cache Database Errors
                6600: 'Your Environment doesn\'t have Databse compatibility',
                6601: 'Database is not defined! (missing db)',
                6602: 'Database Error',
                // Map Errors
                6700: 'You should Enter a Center Location like {lat: " ", lng: " "}'
            },
            getUserInfoRetry = 5,
            getUserInfoRetryCount = 0,
            chatState = false,
            chatFullStateObject = {},
            httpRequestObject = {},
            connectionCheckTimeout = params.connectionCheckTimeout,
            connectionCheckTimeoutThreshold = params.connectionCheckTimeoutThreshold,
            httpRequestTimeout = (params.httpRequestTimeout >= 0) ? params.httpRequestTimeout : 0,
            asyncRequestTimeout = (typeof params.asyncRequestTimeout === 'number' && params.asyncRequestTimeout >= 0) ? params.asyncRequestTimeout : 0,
            callRequestTimeout = (typeof params.callRequestTimeout === 'number' && params.callRequestTimeout >= 0) ? params.callRequestTimeout : 10000,
            httpUploadRequestTimeout = (params.httpUploadRequestTimeout >= 0) ? params.httpUploadRequestTimeout : 0,
            actualTimingLog = (params.asyncLogging.actualTiming && typeof params.asyncLogging.actualTiming === 'boolean')
                ? params.asyncLogging.actualTiming
                : false,
            consoleLogging = (params.asyncLogging.consoleLogging && typeof params.asyncLogging.consoleLogging === 'boolean')
                ? params.asyncLogging.consoleLogging
                : false,
            minIntegerValue = Number.MAX_SAFE_INTEGER * -1,
            maxIntegerValue = Number.MAX_SAFE_INTEGER,
            chatSendQueue = [],
            chatWaitQueue = [],
            chatUploadQueue = [],
            fullResponseObject = params.fullResponseObject || false;

        /*******************************************************
         *            P R I V A T E   M E T H O D S            *
         *******************************************************/

        var init = function () {
                /**
                 * Initialize Cache Databases
                 */
                startCacheDatabases(function () {
                    if (grantDeviceIdFromSSO) {
                        var getDeviceIdWithTokenTime = new Date().getTime();
                        getDeviceIdWithToken(function (retrievedDeviceId) {
                            if (actualTimingLog) {
                                Utility.chatStepLogger('Get Device ID ', new Date().getTime() - getDeviceIdWithTokenTime);
                            }

                            deviceId = retrievedDeviceId;

                            initAsync();
                        });
                    } else {
                        initAsync();
                    }
                });
            },

            /**
             * Initialize Async
             *
             * Initializes Async module and sets proper callbacks
             *
             * @access private
             *
             * @return {undefined}
             * @return {undefined}
             */
            initAsync = function () {
                var asyncGetReadyTime = new Date().getTime();

                asyncClient = new Async({
                    protocol: protocol,
                    queueHost: queueHost,
                    queuePort: queuePort,
                    queueUsername: queueUsername,
                    queuePassword: queuePassword,
                    queueReceive: queueReceive,
                    queueSend: queueSend,
                    queueConnectionTimeout: queueConnectionTimeout,
                    socketAddress: socketAddress,
                    serverName: serverName,
                    deviceId: deviceId,
                    wsConnectionWaitTime: wsConnectionWaitTime,
                    connectionRetryInterval: connectionRetryInterval,
                    connectionCheckTimeout: connectionCheckTimeout,
                    connectionCheckTimeoutThreshold: connectionCheckTimeoutThreshold,
                    messageTtl: messageTtl,
                    reconnectOnClose: reconnectOnClose,
                    asyncLogging: asyncLogging
                });

                asyncClient.on('asyncReady', function () {
                    if (actualTimingLog) {
                        Utility.chatStepLogger('Async Connection ', new Date().getTime() - asyncGetReadyTime);
                    }

                    peerId = asyncClient.getPeerId();

                    if (!userInfo) {
                        var getUserInfoTime = new Date().getTime();

                        getUserInfo(function (userInfoResult) {
                            if (actualTimingLog) {
                                Utility.chatStepLogger('Get User Info ', new Date().getTime() - getUserInfoTime);
                            }
                            if (!userInfoResult.hasError) {
                                userInfo = userInfoResult.result.user;

                                !!Sentry && Sentry.setUser(userInfo);

                                getAllThreads({
                                    summary: true,
                                    cache: false
                                });

                                /**
                                 * Check if user has KeyId stored in their cache or not?
                                 */
                                if (canUseCache) {
                                    if (db) {
                                        db.users
                                            .where('id')
                                            .equals(parseInt(userInfo.id))
                                            .toArray()
                                            .then(function (users) {
                                                if (users.length > 0 && typeof users[0].keyId != 'undefined') {
                                                    var user = users[0];

                                                    getEncryptionKey({
                                                        keyId: user.keyId
                                                    }, function (result) {
                                                        if (!result.hasError) {
                                                            cacheSecret = result.secretKey;

                                                            chatState = true;
                                                            fireEvent('chatReady');
                                                            chatSendQueueHandler();
                                                        } else {
                                                            if (result.message !== '') {
                                                                try {
                                                                    var response = JSON.parse(result.message);
                                                                    if (response.error === 'invalid_param') {
                                                                        generateEncryptionKey({
                                                                            keyAlgorithm: 'AES',
                                                                            keySize: 256
                                                                        }, function () {
                                                                            chatState = true;
                                                                            fireEvent('chatReady');
                                                                            chatSendQueueHandler();
                                                                        });
                                                                    }
                                                                } catch (e) {
                                                                    consoleLogging && console.log(e);
                                                                }
                                                            }
                                                        }
                                                    });
                                                } else {
                                                    generateEncryptionKey({
                                                        keyAlgorithm: 'AES',
                                                        keySize: 256
                                                    }, function () {
                                                        chatState = true;
                                                        fireEvent('chatReady');
                                                        chatSendQueueHandler();
                                                    });
                                                }
                                            })
                                            .catch(function (error) {
                                                fireEvent('error', {
                                                    code: error.errorCode,
                                                    message: error.errorMessage,
                                                    error: error
                                                });
                                            });
                                    } else {
                                        fireEvent('error', {
                                            code: 6601,
                                            message: CHAT_ERRORS[6601],
                                            error: null
                                        });
                                    }
                                } else {
                                    chatState = true;
                                    fireEvent('chatReady');
                                    chatSendQueueHandler();
                                }
                            }
                        });
                    } else if (userInfo.id > 0) {
                        chatState = true;
                        fireEvent('chatReady');
                        chatSendQueueHandler();
                    }

                    deliveryInterval && clearInterval(deliveryInterval);

                    deliveryInterval = setInterval(function () {
                        if (Object.keys(messagesDelivery).length) {
                            messagesDeliveryQueueHandler();
                        }
                    }, deliveryIntervalPitch);

                    seenInterval && clearInterval(seenInterval);

                    seenInterval = setInterval(function () {
                        if (Object.keys(messagesSeen).length) {
                            messagesSeenQueueHandler();
                        }
                    }, seenIntervalPitch);

                    shouldReconnectCall();
                });

                asyncClient.on('stateChange', function (state) {
                    fireEvent('chatState', state);
                    chatFullStateObject = state;

                    switch (state.socketState) {
                        case 1: // CONNECTED
                            if (state.deviceRegister && state.serverRegister) {
                                chatState = true;
                                ping();
                            }
                            break;
                        case 0: // CONNECTING
                        case 2: // CLOSING
                        case 3: // CLOSED
                            chatState = false;

                            // TODO: Check if this is OK or not?!
                            sendPingTimeout && clearTimeout(sendPingTimeout);
                            break;
                    }
                });

                asyncClient.on('connect', function (newPeerId) {
                    asyncGetReadyTime = new Date().getTime();
                    peerId = newPeerId;
                    fireEvent('connect');
                    ping();
                });

                asyncClient.on('disconnect', function (event) {
                    oldPeerId = peerId;
                    peerId = undefined;
                    fireEvent('disconnect', event);

                    fireEvent('callEvents', {
                        type: 'CALL_ERROR',
                        code: 7000,
                        message: 'Call Socket is closed!',
                        error: event
                    });
                });

                asyncClient.on('reconnect', function (newPeerId) {
                    peerId = newPeerId;
                    fireEvent('reconnect');
                });

                asyncClient.on('message', function (params, ack) {
                    receivedAsyncMessageHandler(params);
                    ack && ack();
                });

                asyncClient.on('error', function (error) {
                    fireEvent('error', {
                        code: error.errorCode,
                        message: error.errorMessage,
                        error: error.errorEvent
                    });
                });
            },

            /**
             * Get Device Id With Token
             *
             * If ssoGrantDevicesAddress set as TRUE, chat agent gets Device ID
             * from SSO server and passes it to Async Module
             *
             * @access private
             *
             * @param {function}  callback    The callback function to run after getting Device Id
             *
             * @return {undefined}
             */
            getDeviceIdWithToken = function (callback) {
                var deviceId;

                var params = {
                    url: SERVICE_ADDRESSES.SSO_ADDRESS + SERVICES_PATH.SSO_DEVICES,
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                };

                httpRequest(params, function (result) {
                    if (!result.hasError) {
                        var devices = JSON.parse(result.result.responseText).devices;
                        if (devices && devices.length > 0) {
                            for (var i = 0; i < devices.length; i++) {
                                if (devices[i].current) {
                                    deviceId = devices[i].uid;
                                    break;
                                }
                            }

                            if (!deviceId) {
                                fireEvent('error', {
                                    code: 6000,
                                    message: CHAT_ERRORS[6000],
                                    error: null
                                });
                            } else {
                                callback(deviceId);
                            }
                        } else {
                            fireEvent('error', {
                                code: 6001,
                                message: CHAT_ERRORS[6001],
                                error: null
                            });
                        }
                    } else {
                        fireEvent('error', {
                            code: result.errorCode,
                            message: result.errorMessage,
                            error: result
                        });
                    }
                });
            },

            /**
             * Handshake with SSO to get user's keys
             *
             * In order to Encrypt and Decrypt cache we need a key.
             * We can retrieve encryption keys from SSO, all we
             * need to do is to do a handshake with SSO and
             * get the keys.
             *
             * @access private
             *
             * @param params
             * @param {function}  callback    The callback function to run after Generating Keys
             *
             * @return {undefined}
             */
            generateEncryptionKey = function (params, callback) {
                var data = {
                    validity: 10 * 365 * 24 * 60 * 60, // 10 Years
                    renew: false,
                    keyAlgorithm: 'aes',
                    keySize: 256
                };

                if (params) {
                    if (params.keyAlgorithm !== undefined) {
                        data.keyAlgorithm = params.keyAlgorithm;
                    }

                    if (parseInt(params.keySize) > 0) {
                        data.keySize = params.keySize;
                    }
                }

                var httpRequestParams = {
                    url: SERVICE_ADDRESSES.SSO_ADDRESS + SERVICES_PATH.SSO_GENERATE_KEY,
                    method: 'POST',
                    data: data,
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                };

                httpRequest(httpRequestParams, function (result) {
                    if (!result.hasError) {
                        try {
                            var response = JSON.parse(result.result.responseText);
                        } catch (e) {
                            consoleLogging && console.log(e);
                        }

                        /**
                         * Save new Key Id in cache and update cacheSecret
                         */
                        if (canUseCache) {
                            if (db) {
                                db.users
                                    .update(userInfo.id, {keyId: response.keyId})
                                    .then(function () {
                                        getEncryptionKey({
                                            keyId: response.keyId
                                        }, function (result) {
                                            if (!result.hasError) {
                                                cacheSecret = result.secretKey;
                                                callback && callback();
                                            }
                                        });
                                    })
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }
                    } else {
                        fireEvent('error', {
                            code: result.error,
                            message: result.error_description,
                            error: result
                        });
                    }
                });
            },

            /**
             * Get Encryption Keys by KeyId
             *
             * In order to Encrypt and Decrypt cache we need a key.
             * We can retrieve encryption keys from SSO by sending
             * KeyId to SSO and get related keys
             *
             * @access private
             *
             * @param params
             * @param {function}  callback    The callback function to run after getting Keys
             *
             * @return {undefined}
             */
            getEncryptionKey = function (params, callback) {
                var keyId;

                if (params) {
                    if (typeof params.keyId !== 'undefined') {
                        keyId = params.keyId;

                        var httpRequestParams = {
                            url: SERVICE_ADDRESSES.SSO_ADDRESS + SERVICES_PATH.SSO_GET_KEY + keyId,
                            method: 'GET',
                            headers: {
                                'Authorization': 'Bearer ' + token
                            }
                        };

                        httpRequest(httpRequestParams, function (result) {
                            if (!result.hasError) {
                                try {
                                    var response = JSON.parse(result.result.responseText);
                                } catch (e) {
                                    consoleLogging && console.log(e);
                                }

                                callback && callback({
                                    hasError: false,
                                    secretKey: response.secretKey
                                });
                            } else {
                                callback && callback({
                                    hasError: true,
                                    code: result.errorCode,
                                    message: result.errorMessage
                                });

                                fireEvent('error', {
                                    code: result.errorCode,
                                    message: result.errorMessage,
                                    error: result
                                });
                            }
                        });
                    }
                }
            },

            /**
             * HTTP Request class
             *
             * Manages all HTTP Requests
             *
             * @access private
             *
             * @param {object}    params      Given parameters including (Headers, ...)
             * @param {function}  callback    The callback function to run after
             *
             * @return {undefined}
             */
            httpRequest = function (params, callback) {
                var url = params.url,
                    xhrResponseType = params.responseType || 'text',
                    fileSize,
                    originalFileName,
                    threadId,
                    fileUniqueId,
                    fileObject,
                    data = params.data,
                    method = (typeof params.method == 'string')
                        ? params.method
                        : 'GET',
                    fileUploadUniqueId = (typeof params.uniqueId == 'string')
                        ? params.uniqueId
                        : 'uniqueId',
                    hasError = false;

                if (!url) {
                    callback({
                        hasError: true,
                        errorCode: 6201,
                        errorMessage: CHAT_ERRORS[6201]
                    });
                    return;
                }

                var hasFile = false;

                httpRequestObject[eval('fileUploadUniqueId')] = new XMLHttpRequest();
                var settings = params.settings;

                httpRequestObject[eval('fileUploadUniqueId')].responseType = xhrResponseType;

                if (data && typeof data === 'object' && (data.hasOwnProperty('image') || data.hasOwnProperty('file'))) {
                    httpRequestObject[eval('fileUploadUniqueId')].timeout = (settings && typeof parseInt(settings.uploadTimeout) > 0 && settings.uploadTimeout > 0)
                        ? settings.uploadTimeout
                        : httpUploadRequestTimeout;
                } else {
                    httpRequestObject[eval('fileUploadUniqueId')].timeout = (settings && typeof parseInt(settings.timeout) > 0 && settings.timeout > 0)
                        ? settings.timeout
                        : httpRequestTimeout;
                }

                httpRequestObject[eval('fileUploadUniqueId')]
                    .addEventListener('error', function (event) {
                        if (callback) {
                            if (hasFile) {
                                hasError = true;
                                fireEvent('fileUploadEvents', {
                                    threadId: threadId,
                                    uniqueId: fileUniqueId,
                                    state: 'UPLOAD_ERROR',
                                    progress: 0,
                                    fileInfo: {
                                        fileName: originalFileName,
                                        fileSize: fileSize
                                    },
                                    fileObject: fileObject,
                                    errorCode: 6200,
                                    errorMessage: CHAT_ERRORS[6200] + ' (XMLHttpRequest Error Event Listener)'
                                });
                            }
                            callback({
                                hasError: true,
                                errorCode: 6200,
                                errorMessage: CHAT_ERRORS[6200] + ' (XMLHttpRequest Error Event Listener)'
                            });
                        }
                    }, false);

                httpRequestObject[eval('fileUploadUniqueId')].addEventListener('abort',
                    function (event) {
                        if (callback) {
                            if (hasFile) {
                                hasError = true;
                                fireEvent('fileUploadEvents', {
                                    threadId: threadId,
                                    uniqueId: fileUniqueId,
                                    state: 'UPLOAD_CANCELED',
                                    progress: 0,
                                    fileInfo: {
                                        fileName: originalFileName,
                                        fileSize: fileSize
                                    },
                                    fileObject: fileObject,
                                    errorCode: 6303,
                                    errorMessage: CHAT_ERRORS[6303]
                                });
                            }
                            callback({
                                hasError: true,
                                errorCode: 6303,
                                errorMessage: CHAT_ERRORS[6303]
                            });
                        }
                    }, false);

                try {
                    if (method === 'GET') {
                        if (typeof data === 'object' && data !== null) {
                            var keys = Object.keys(data);

                            if (keys.length > 0) {
                                url += '?';

                                for (var i = 0; i < keys.length; i++) {
                                    var key = keys[i];
                                    url += key + '=' + data[key];
                                    if (i < keys.length - 1) {
                                        url += '&';
                                    }
                                }
                            }
                        } else if (typeof data === 'string') {
                            url += '?' + data;
                        }

                        httpRequestObject[eval('fileUploadUniqueId')].open(method, url, true);

                        if (typeof params.headers === 'object') {
                            for (var key in params.headers) {
                                if (params.headers.hasOwnProperty(key))
                                    httpRequestObject[eval('fileUploadUniqueId')].setRequestHeader(key, params.headers[key]);
                            }
                        }

                        httpRequestObject[eval('fileUploadUniqueId')].send();
                    }

                    if (method === 'POST' && data) {

                        httpRequestObject[eval('fileUploadUniqueId')].open(method, url, true);

                        if (typeof params.headers === 'object') {
                            for (var key in params.headers) {
                                if (params.headers.hasOwnProperty(key))
                                    httpRequestObject[eval('fileUploadUniqueId')].setRequestHeader(key, params.headers[key]);
                            }
                        }

                        if (typeof data == 'object') {
                            if (data.hasOwnProperty('image') || data.hasOwnProperty('file')) {
                                hasFile = true;
                                var formData = new FormData();
                                for (var key in data) {
                                    if (data.hasOwnProperty(key))
                                        formData.append(key, data[key]);
                                }

                                fileSize = data.fileSize;
                                originalFileName = data.originalFileName;
                                threadId = data.threadId;
                                fileUniqueId = data.uniqueId;
                                fileObject = (data['image'])
                                    ? data['image']
                                    : data['file'];

                                httpRequestObject[eval('fileUploadUniqueId')].upload.onprogress = function (event) {
                                    if (event.lengthComputable && !hasError) {
                                        fireEvent('fileUploadEvents', {
                                            threadId: threadId,
                                            uniqueId: fileUniqueId,
                                            state: 'UPLOADING',
                                            progress: Math.round((event.loaded / event.total) * 100),
                                            fileInfo: {
                                                fileName: originalFileName,
                                                fileSize: fileSize
                                            },
                                            fileObject: fileObject
                                        });
                                    }
                                };

                                httpRequestObject[eval('fileUploadUniqueId')].send(formData);
                            } else {
                                httpRequestObject[eval('fileUploadUniqueId')].setRequestHeader(
                                    'Content-Type',
                                    'application/x-www-form-urlencoded');

                                var keys = Object.keys(data);

                                if (keys.length > 0) {
                                    var sendData = '';

                                    for (var i = 0; i < keys.length; i++) {
                                        var key = keys[i];
                                        sendData += key + '=' + data[key];
                                        if (i < keys.length - 1) {
                                            sendData += '&';
                                        }
                                    }
                                }

                                httpRequestObject[eval('fileUploadUniqueId')].send(sendData);
                            }
                        } else {
                            httpRequestObject[eval('fileUploadUniqueId')].send(data);
                        }
                    }
                } catch (e) {
                    callback && callback({
                        hasError: true,
                        cache: false,
                        errorCode: 6200,
                        errorMessage: CHAT_ERRORS[6200] + ' (Request Catch Error)' + e
                    });
                }

                httpRequestObject[eval('fileUploadUniqueId')].onreadystatechange = function () {
                    if (httpRequestObject[eval('fileUploadUniqueId')].readyState === 4) {
                        if (httpRequestObject[eval('fileUploadUniqueId')].status === 200) {
                            if (hasFile) {
                                hasError = false;
                                var fileHashCode = '';
                                try {
                                    var fileUploadResult = JSON.parse(httpRequestObject[eval('fileUploadUniqueId')].response);
                                    if (!!fileUploadResult && fileUploadResult.hasOwnProperty('result')) {
                                        fileHashCode = fileUploadResult.result.hashCode;
                                    }
                                } catch (e) {
                                    consoleLogging && console.log(e)
                                }

                                fireEvent('fileUploadEvents', {
                                    threadId: threadId,
                                    uniqueId: fileUniqueId,
                                    fileHash: fileHashCode,
                                    state: 'UPLOADED',
                                    progress: 100,
                                    fileInfo: {
                                        fileName: originalFileName,
                                        fileSize: fileSize
                                    },
                                    fileObject: fileObject
                                });
                            }

                            callback && callback({
                                hasError: false,
                                cache: false,
                                result: {
                                    response: httpRequestObject[eval('fileUploadUniqueId')].response,
                                    responseText: (xhrResponseType === 'text') ? httpRequestObject[eval('fileUploadUniqueId')].responseText : '',
                                    responseHeaders: httpRequestObject[eval('fileUploadUniqueId')].getAllResponseHeaders(),
                                    responseContentType: httpRequestObject[eval('fileUploadUniqueId')].getResponseHeader('content-type')
                                }
                            });
                        } else {
                            if (hasFile) {
                                hasError = true;
                                fireEvent('fileUploadEvents', {
                                    threadId: threadId,
                                    uniqueId: fileUniqueId,
                                    state: 'UPLOAD_ERROR',
                                    progress: 0,
                                    fileInfo: {
                                        fileName: originalFileName,
                                        fileSize: fileSize
                                    },
                                    fileObject: fileObject,
                                    errorCode: 6200,
                                    errorMessage: CHAT_ERRORS[6200] + ' (Request Status != 200)',
                                    statusCode: httpRequestObject[eval('fileUploadUniqueId')].status
                                });
                            }
                            callback && callback({
                                hasError: true,
                                errorMessage: (xhrResponseType === 'text') ? httpRequestObject[eval('fileUploadUniqueId')].responseText : 'ُAn error accoured!',
                                errorCode: httpRequestObject[eval('fileUploadUniqueId')].status
                            });
                        }
                    }
                };
            },

            /**
             * Get User Info
             *
             * This functions gets user info from chat serverName.
             * If info is not retrived the function will attemp
             * 5 more times to get info from erver
             *
             * @recursive
             * @access private
             *
             * @param {function}    callback    The callback function to call after
             *
             * @return {object} Instant function return
             */
            getUserInfo = function getUserInfoRecursive(callback) {
                getUserInfoRetryCount++;

                if (getUserInfoRetryCount > getUserInfoRetry) {
                    getUserInfoTimeout && clearTimeout(getUserInfoTimeout);

                    getUserInfoRetryCount = 0;

                    fireEvent('error', {
                        code: 6101,
                        message: CHAT_ERRORS[6101],
                        error: null
                    });
                } else {
                    getUserInfoTimeout && clearTimeout(getUserInfoTimeout);

                    getUserInfoTimeout = setTimeout(function () {
                        getUserInfoRecursive(callback);
                    }, getUserInfoRetryCount * 10000);

                    return sendMessage({
                        chatMessageVOType: chatMessageVOTypes.USER_INFO,
                        typeCode: params.typeCode
                    }, {
                        onResult: function (result) {
                            var returnData = {
                                hasError: result.hasError,
                                cache: false,
                                errorMessage: result.errorMessage,
                                errorCode: result.errorCode
                            };

                            if (!returnData.hasError) {
                                getUserInfoTimeout && clearTimeout(getUserInfoTimeout);

                                var messageContent = result.result;
                                var currentUser = formatDataToMakeUser(messageContent);

                                /**
                                 * Add current user into cache database #cache
                                 */
                                if (canUseCache) {
                                    if (db) {
                                        db.users
                                            .where('id')
                                            .equals(parseInt(currentUser.id))
                                            .toArray()
                                            .then(function (users) {
                                                if (users.length > 0 && users[0].id > 0) {
                                                    db.users
                                                        .update(currentUser.id, {
                                                            cellphoneNumber: currentUser.cellphoneNumber,
                                                            email: currentUser.email,
                                                            image: currentUser.image,
                                                            name: currentUser.name
                                                        })
                                                        .catch(function (error) {
                                                            fireEvent('error', {
                                                                code: error.code,
                                                                message: error.message,
                                                                error: error
                                                            });
                                                        });
                                                } else {
                                                    db.users.put(currentUser)
                                                        .catch(function (error) {
                                                            fireEvent('error', {
                                                                code: error.code,
                                                                message: error.message,
                                                                error: error
                                                            });
                                                        });
                                                }
                                            });
                                    } else {
                                        fireEvent('error', {
                                            code: 6601,
                                            message: CHAT_ERRORS[6601],
                                            error: null
                                        });
                                    }
                                }

                                returnData.result = {
                                    user: currentUser
                                };

                                getUserInfoRetryCount = 0;

                                callback && callback(returnData);

                                /**
                                 * Delete callback so if server pushes response
                                 * before cache, cache won't send data again
                                 */
                                callback = undefined;
                            }
                        }
                    });
                }
            },

            /**
             * Send Message
             *
             * All socket messages go through this function
             *
             * @access private
             *
             * @param {string}    token           SSO Token of current user
             * @param {string}    tokenIssuer     Issuer of token (default : 1)
             * @param {int}       type            Type of message (object : chatMessageVOTypes)
             * @param {string}    typeCode        Type of contact who is going to receive the message
             * @param {int}       messageType     Type of Message, in order to filter messages
             * @param {long}      subjectId       Id of chat thread
             * @param {string}    uniqueId        Tracker id for client
             * @param {string}    content         Content of message
             * @param {long}      time            Time of message, filled by chat server
             * @param {string}    medadata        Metadata for message (Will use when needed)
             * @param {string}    systemMedadata  Metadata for message (To be Set by client)
             * @param {long}      repliedTo       Id of message to reply to (Should be filled by client)
             * @param {function}  callback        The callback function to run after
             *
             * @return {object} Instant Function Return
             */
            sendMessage = function (params, callbacks, recursiveCallback) {
                /**
                 * + ChatMessage        {object}
                 *    - token           {string}
                 *    - tokenIssuer     {string}
                 *    - type            {int}
                 *    - typeCode        {string}
                 *    - messageType     {int}
                 *    - subjectId       {int}
                 *    - uniqueId        {string}
                 *    - content         {string}
                 *    - time            {int}
                 *    - medadata        {string}
                 *    - systemMedadata  {string}
                 *    - repliedTo       {int}
                 */
                var threadId = null;

                var asyncPriority = (params.asyncPriority > 0)
                    ? params.asyncPriority
                    : msgPriority;

                var messageVO = {
                    type: params.chatMessageVOType,
                    token: token,
                    tokenIssuer: 1
                };

                if (params.typeCode) {
                    messageVO.typeCode = params.typeCode;
                } else if (generalTypeCode) {
                    messageVO.typeCode = generalTypeCode;
                }

                if (params.messageType) {
                    messageVO.messageType = params.messageType;
                }

                if (params.subjectId) {
                    threadId = params.subjectId;
                    messageVO.subjectId = params.subjectId;
                }

                if (params.content) {
                    if (typeof params.content == 'object') {
                        messageVO.content = JSON.stringify(params.content);
                    } else {
                        messageVO.content = params.content;
                    }
                }

                if (params.metadata) {
                    messageVO.metadata = params.metadata;
                }

                if (params.systemMetadata) {
                    messageVO.systemMetadata = params.systemMetadata;
                }

                if (params.repliedTo) {
                    messageVO.repliedTo = params.repliedTo;
                }

                var uniqueId;

                if (typeof params.uniqueId != 'undefined') {
                    uniqueId = params.uniqueId;
                } else if (params.chatMessageVOType !== chatMessageVOTypes.PING) {
                    uniqueId = Utility.generateUUID();
                }

                if (Array.isArray(uniqueId)) {
                    messageVO.uniqueId = JSON.stringify(uniqueId);
                } else {
                    messageVO.uniqueId = uniqueId;
                }

                if (typeof callbacks == 'object') {
                    if (callbacks.onSeen || callbacks.onDeliver || callbacks.onSent) {
                        if (!threadCallbacks[threadId]) {
                            threadCallbacks[threadId] = {};
                        }

                        threadCallbacks[threadId][uniqueId] = {};

                        sendMessageCallbacks[uniqueId] = {};

                        if (callbacks.onSent) {
                            sendMessageCallbacks[uniqueId].onSent = callbacks.onSent;
                            threadCallbacks[threadId][uniqueId].onSent = false;
                            threadCallbacks[threadId][uniqueId].uniqueId = uniqueId;
                        }

                        if (callbacks.onSeen) {
                            sendMessageCallbacks[uniqueId].onSeen = callbacks.onSeen;
                            threadCallbacks[threadId][uniqueId].onSeen = false;
                        }

                        if (callbacks.onDeliver) {
                            sendMessageCallbacks[uniqueId].onDeliver = callbacks.onDeliver;
                            threadCallbacks[threadId][uniqueId].onDeliver = false;
                        }

                    } else if (callbacks.onResult) {
                        messagesCallbacks[uniqueId] = callbacks.onResult;
                    }
                } else if (typeof callbacks == 'function') {
                    messagesCallbacks[uniqueId] = callbacks;
                }

                /**
                 * Message to send through async SDK
                 *
                 * + MessageWrapperVO  {object}
                 *    - type           {int}       Type of ASYNC message based on content
                 *    + content        {string}
                 *       -peerName     {string}    Name of receiver Peer
                 *       -receivers[]  {int}      Array of receiver peer ids (if you use this, peerName will be ignored)
                 *       -priority     {int}       Priority of message 1-10, lower has more priority
                 *       -messageId    {int}      Id of message on your side, not required
                 *       -ttl          {int}      Time to live for message in milliseconds
                 *       -content      {string}    Chat Message goes here after stringifying
                 *    - trackId        {int}      Tracker id of message that you receive from DIRANA previously (if you are replying a sync message)
                 */

                var data = {
                    type: (parseInt(params.pushMsgType) > 0)
                        ? params.pushMsgType
                        : 3,
                    content: {
                        peerName: serverName,
                        priority: asyncPriority,
                        content: JSON.stringify(messageVO),
                        ttl: (params.messageTtl > 0)
                            ? params.messageTtl
                            : messageTtl
                    }
                };

                asyncClient.send(data, function (res) {
                    if (!res.hasError && callbacks) {
                        if (typeof callbacks == 'function') {
                            callbacks(res);
                        } else if (typeof callbacks == 'object' && typeof callbacks.onResult == 'function') {
                            callbacks.onResult(res);
                        }

                        if (messagesCallbacks[uniqueId]) {
                            delete messagesCallbacks[uniqueId];
                        }
                    }
                });

                if (asyncRequestTimeout > 0) {
                    asyncRequestTimeouts[uniqueId] && clearTimeout(asyncRequestTimeouts[uniqueId]);
                    asyncRequestTimeouts[uniqueId] = setTimeout(function () {
                        if (typeof callbacks == 'function') {
                            callbacks({
                                hasError: true,
                                errorCode: 408,
                                errorMessage: 'Async Request Timed Out!'
                            });
                        } else if (typeof callbacks == 'object' && typeof callbacks.onResult == 'function') {
                            callbacks.onResult({
                                hasError: true,
                                errorCode: 408,
                                errorMessage: 'Async Request Timed Out!'
                            });
                        }

                        if (messagesCallbacks[uniqueId]) {
                            delete messagesCallbacks[uniqueId];
                        }
                        if (sendMessageCallbacks[uniqueId]) {
                            delete sendMessageCallbacks[uniqueId];
                        }
                        if (!!threadCallbacks[threadId] && threadCallbacks[threadId][uniqueId]) {
                            threadCallbacks[threadId][uniqueId] = {};
                            delete threadCallbacks[threadId][uniqueId];
                        }

                    }, asyncRequestTimeout);
                }

                sendPingTimeout && clearTimeout(sendPingTimeout);
                sendPingTimeout = setTimeout(function () {
                    ping();
                }, chatPingMessageInterval);

                recursiveCallback && recursiveCallback();

                return {
                    uniqueId: uniqueId,
                    threadId: threadId,
                    participant: userInfo,
                    content: params.content
                };
            },

            sendCallMessage = function (message, callback) {
                message.token = token;

                var uniqueId;

                if (typeof params.uniqueId != 'undefined') {
                    uniqueId = params.uniqueId;
                } else {
                    uniqueId = Utility.generateUUID();
                }

                message.uniqueId = uniqueId;

                var data = {
                    type: 3,
                    content: {
                        peerName: callServerName,
                        priority: 1,
                        content: JSON.stringify(message),
                        ttl: messageTtl
                    }
                };

                if (typeof callback == 'function') {
                    messagesCallbacks[uniqueId] = callback;
                }

                asyncClient.send(data, function (res) {
                    if (!res.hasError && callback) {
                        if (typeof callback == 'function') {
                            callback(res);
                        }

                        if (messagesCallbacks[uniqueId]) {
                            delete messagesCallbacks[uniqueId];
                        }
                    }
                });

                if (callRequestTimeout > 0) {
                    asyncRequestTimeouts[uniqueId] && clearTimeout(asyncRequestTimeouts[uniqueId]);
                    asyncRequestTimeouts[uniqueId] = setTimeout(function () {
                        if (typeof callback == 'function') {
                            callback({
                                done: 'SKIP'
                            });
                        }

                        if (messagesCallbacks[uniqueId]) {
                            delete messagesCallbacks[uniqueId];
                        }
                    }, callRequestTimeout);
                }
            },

            sendSystemMessage = function (params) {
                return sendMessage({
                    chatMessageVOType: chatMessageVOTypes.SYSTEM_MESSAGE,
                    subjectId: params.threadId,
                    content: params.content,
                    uniqueId: params.uniqueId,
                    pushMsgType: 3
                });
            },

            /**
             * Chat Send Message Queue Handler
             *
             * Whenever something pushes into cahtSendQueue
             * this function invokes and does the message
             * sending progress throught async
             *
             * @access private
             *
             * @return {undefined}
             */
            chatSendQueueHandler = function () {
                if (chatSendQueue.length) {
                    var messageToBeSend = chatSendQueue[0];

                    /**
                     * Getting chatSendQueue from either cache or
                     * memory and scrolling through the send queue
                     * to send all the messages which are waiting
                     * for chatState to become TRUE
                     *
                     * There is a small possibility that a Message
                     * wouldn't make it through network, so it Will
                     * not reach chat server. To avoid losing those
                     * messages, we put a clone of every message
                     * in waitQ, and when ack of the message comes,
                     * we delete that message from waitQ. otherwise
                     * we assume that these messages have been failed to
                     * send and keep them to be either canceled or resent
                     * by user later. When user calls getHistory(), they
                     * will have failed messages alongside with typical
                     * messages history.
                     */
                    if (chatState) {
                        getChatSendQueue(0, function (chatSendQueue) {
                            deleteFromChatSentQueue(messageToBeSend,
                                function () {
                                    sendMessage(messageToBeSend.message, messageToBeSend.callbacks, function () {
                                        if (chatSendQueue.length) {
                                            chatSendQueueHandler();
                                        }
                                    });
                                });
                        });
                    }
                }
            },

            putInMessagesDeliveryQueue = function (threadId, messageId) {
                if (messagesDelivery.hasOwnProperty(threadId)
                    && typeof messagesDelivery[threadId] === 'number'
                    && !!messagesDelivery[threadId]) {
                    if (messagesDelivery[threadId] < messageId) {
                        messagesDelivery[threadId] = messageId;
                    }
                } else {
                    messagesDelivery[threadId] = messageId;
                }
            },

            putInMessagesSeenQueue = function (threadId, messageId) {
                if (messagesSeen.hasOwnProperty(threadId)
                    && typeof messagesSeen[threadId] === 'number'
                    && !!messagesSeen[threadId]) {
                    if (messagesSeen[threadId] < messageId) {
                        messagesSeen[threadId] = messageId;
                    }
                } else {
                    messagesSeen[threadId] = messageId;
                }
            },

            /**
             * Messages Delivery Queue Handler
             *
             * Whenever something pushes into messagesDelivery
             * this function invokes and does the message
             * delivery progress throught async
             *
             * @access private
             *
             * @return {undefined}
             */
            messagesDeliveryQueueHandler = function () {
                if (Object.keys(messagesDelivery).length) {
                    if (chatState) {
                        for (var key in messagesDelivery) {
                            deliver({
                                messageId: messagesDelivery[key]
                            });

                            delete messagesDelivery[key];
                        }
                    }
                }
            },

            /**
             * Messages Seen Queue Handler
             *
             * Whenever something pushes into messagesSeen
             * this function invokes and does the message
             * seen progress throught async
             *
             * @access private
             *
             * @return {undefined}
             */
            messagesSeenQueueHandler = function () {
                if (Object.keys(messagesSeen).length) {
                    if (chatState) {
                        for (var key in messagesSeen) {
                            seen({
                                messageId: messagesSeen[key]
                            });

                            delete messagesSeen[key];
                        }
                    }
                }
            },

            /**
             * Ping
             *
             * This Function sends ping message to keep user connected to
             * chat server and updates its status
             *
             * @access private
             *
             * @return {undefined}
             */
            ping = function () {
                if (chatState && typeof userInfo !== 'undefined') {
                    /**
                     * Ping messages should be sent ASAP, because
                     * we don't want to wait for send queue, we send them
                     * right through async from here
                     */
                    sendMessage({
                        chatMessageVOType: chatMessageVOTypes.PING,
                        pushMsgType: 3
                    });
                } else {
                    sendPingTimeout && clearTimeout(sendPingTimeout);
                }
            },

            /**
             * Clear Cache
             *
             * Clears Async queue so that all the remained messages will be
             * ignored
             *
             * @access private
             *
             * @return {undefined}
             */
            clearChatServerCaches = function () {
                sendMessage({
                    chatMessageVOType: chatMessageVOTypes.LOGOUT,
                    pushMsgType: 3
                });
            },

            /**
             * Received Async Message Handler
             *
             * This functions parses received message from async
             *
             * @access private
             *
             * @param {object}    asyncMessage    Received Message from Async
             *
             * @return {undefined}
             */
            receivedAsyncMessageHandler = function (asyncMessage) {
                /**
                 * + Message Received From Async      {object}
                 *    - id                            {int}
                 *    - senderMessageId               {int}
                 *    - senderName                    {string}
                 *    - senderId                      {int}
                 *    - type                          {int}
                 *    - content                       {string}
                 */

                if (asyncMessage.senderName === serverName) {
                    var content = JSON.parse(asyncMessage.content);
                    chatMessageHandler(content);
                } else {
                    callMessageHandler(asyncMessage);
                }
            },

            /**
             * is Valid Json
             *
             * This functions checks if a string is valid json or not?
             *
             * @access private
             *
             * @param {string}  jsonString   Json String to be checked
             *
             * @return {boolean}
             */
            isValidJson = function (jsonString) {
                try {
                    JSON.parse(jsonString);
                } catch (e) {
                    return false;
                }
                return true;
            },

            /**
             * Chat Message Handler
             *
             * Manages received chat messages and do the job
             *
             * @access private
             *
             * @param {object}    chatMessage     Content of Async Message which is considered as Chat Message
             *
             * @return {undefined}
             */
            chatMessageHandler = function (chatMessage) {
                var threadId = chatMessage.subjectId,
                    type = chatMessage.type,
                    messageContent = (typeof chatMessage.content === 'string' && isValidJson(chatMessage.content))
                        ? JSON.parse(chatMessage.content)
                        : chatMessage.content,
                    contentCount = chatMessage.contentCount,
                    uniqueId = chatMessage.uniqueId,
                    time = chatMessage.time;

                asyncRequestTimeouts[uniqueId] && clearTimeout(asyncRequestTimeouts[uniqueId]);

                switch (type) {
                    /**
                     * Type 1    Get Threads
                     */
                    case chatMessageVOTypes.CREATE_THREAD:
                        messageContent.uniqueId = uniqueId;

                        if (messagesCallbacks[uniqueId]) {
                            createThread(messageContent, true, true);
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        } else {
                            createThread(messageContent, true, false);
                        }

                        break;

                    /**
                     * Type 2    Message
                     */
                    case chatMessageVOTypes.MESSAGE:
                        newMessageHandler(threadId, messageContent);
                        break;

                    /**
                     * Type 3    Message Sent
                     */
                    case chatMessageVOTypes.SENT:
                        if (sendMessageCallbacks[uniqueId] && sendMessageCallbacks[uniqueId].onSent) {
                            sendMessageCallbacks[uniqueId].onSent({
                                uniqueId: uniqueId,
                                messageId: messageContent
                            });
                            delete (sendMessageCallbacks[uniqueId].onSent);
                            threadCallbacks[threadId][uniqueId].onSent = true;
                        }
                        break;

                    /**
                     * Type 4    Message Delivery
                     */
                    case chatMessageVOTypes.DELIVERY:
                        var threadObject = {
                            id: messageContent.conversationId,
                            lastSeenMessageId: messageContent.messageId,
                            lastSeenMessageTime: messageContent.messageTime,
                            lastParticipantId: messageContent.participantId
                        };

                        fireEvent('threadEvents', {
                            type: 'THREAD_LAST_ACTIVITY_TIME',
                            result: {
                                thread: threadObject
                            }
                        });

                        // if (fullResponseObject) {
                        //     getHistory({
                        //         offset: 0,
                        //         threadId: threadId,
                        //         id: messageContent.messageId,
                        //         cache: false
                        //     }, function (result) {
                        //         if (!result.hasError) {
                        //             fireEvent('messageEvents', {
                        //                 type: 'MESSAGE_DELIVERY',
                        //                 result: {
                        //                     message: result.result.history[0],
                        //                     threadId: threadId,
                        //                     senderId: messageContent.participantId
                        //                 }
                        //             });
                        //         }
                        //     });
                        // } else {
                        //     fireEvent('messageEvents', {
                        //         type: 'MESSAGE_DELIVERY',
                        //         result: {
                        //             message: messageContent.messageId,
                        //             threadId: threadId,
                        //             senderId: messageContent.participantId
                        //         }
                        //     });
                        // }

                        sendMessageCallbacksHandler(chatMessageVOTypes.DELIVERY, threadId, uniqueId);
                        break;

                    /**
                     * Type 5    Message Seen
                     */
                    case chatMessageVOTypes.SEEN:
                        var threadObject = {
                            id: messageContent.conversationId,
                            lastSeenMessageId: messageContent.messageId,
                            lastSeenMessageTime: messageContent.messageTime,
                            lastParticipantId: messageContent.participantId
                        };

                        fireEvent('threadEvents', {
                            type: 'THREAD_LAST_ACTIVITY_TIME',
                            result: {
                                thread: threadObject
                            }
                        });

                        // if (fullResponseObject) {
                        //     getHistory({
                        //         offset: 0,
                        //         threadId: threadId,
                        //         id: messageContent.messageId,
                        //         cache: false
                        //     }, function (result) {
                        //         if (!result.hasError) {
                        //             fireEvent('messageEvents', {
                        //                 type: 'MESSAGE_SEEN',
                        //                 result: {
                        //                     message: result.result.history[0],
                        //                     threadId: threadId,
                        //                     senderId: messageContent.participantId
                        //                 }
                        //             });
                        //         }
                        //     });
                        // } else {
                        //     fireEvent('messageEvents', {
                        //         type: 'MESSAGE_SEEN',
                        //         result: {
                        //             message: messageContent.messageId,
                        //             threadId: threadId,
                        //             senderId: messageContent.participantId
                        //         }
                        //     });
                        // }

                        sendMessageCallbacksHandler(chatMessageVOTypes.SEEN, threadId, uniqueId);
                        break;

                    /**
                     * Type 6    Chat Ping
                     */
                    case chatMessageVOTypes.PING:
                        break;

                    /**
                     * Type 7    Block Contact
                     */
                    case chatMessageVOTypes.BLOCK:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }
                        break;

                    /**
                     * Type 8    Unblock Blocked User
                     */
                    case chatMessageVOTypes.UNBLOCK:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }
                        break;

                    /**
                     * Type 9   Leave Thread
                     */
                    case chatMessageVOTypes.LEAVE_THREAD:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        /**
                         * Remove the participant from cache
                         */
                        if (canUseCache) {
                            if (db) {
                                /**
                                 * Remove the participant from participants
                                 * table
                                 */
                                db.participants.where('threadId')
                                    .equals(parseInt(threadId))
                                    .and(function (participant) {
                                        return (participant.id === messageContent.id || participant.owner === userInfo.id);
                                    })
                                    .delete()
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });

                                /**
                                 * If this is the user who is leaving the thread
                                 * we should delete the thread and messages of
                                 * thread from this users cache database
                                 */

                                if (messageContent.id === userInfo.id) {

                                    /**
                                     * Remove Thread from this users cache
                                     */
                                    db.threads.where('[owner+id]')
                                        .equals([userInfo.id, threadId])
                                        .delete()
                                        .catch(function (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        });

                                    /**
                                     * Remove all messages of the thread which
                                     * this user left
                                     */
                                    db.messages.where('threadId')
                                        .equals(parseInt(threadId))
                                        .and(function (message) {
                                            return message.owner === userInfo.id;
                                        })
                                        .delete()
                                        .catch(function (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        });
                                }
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [threadId]
                            }, function (threadsResult) {
                                if (!threadsResult.cache) {
                                    var threads = threadsResult.result.threads;
                                    if (threads.length > 0) {
                                        fireEvent('threadEvents', {
                                            type: 'THREAD_LEAVE_PARTICIPANT',
                                            result: {
                                                thread: threads[0],
                                                participant: formatDataToMakeParticipant(messageContent, threadId)
                                            }
                                        });

                                        fireEvent('threadEvents', {
                                            type: 'THREAD_LAST_ACTIVITY_TIME',
                                            result: {
                                                thread: threads[0]
                                            }
                                        });
                                    } else {
                                        fireEvent('threadEvents', {
                                            type: 'THREAD_LEAVE_PARTICIPANT',
                                            result: {
                                                threadId: threadId,
                                                participant: formatDataToMakeParticipant(messageContent, threadId)
                                            }
                                        });
                                    }
                                }
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_LEAVE_PARTICIPANT',
                                result: {
                                    thread: threadId,
                                    participant: formatDataToMakeParticipant(messageContent, threadId)
                                }
                            });

                            fireEvent('threadEvents', {
                                type: 'THREAD_LAST_ACTIVITY_TIME',
                                result: {
                                    thread: threadId
                                }
                            });
                        }
                        break;

                    /**
                     * Type 11    Add Participant to Thread
                     */
                    case chatMessageVOTypes.ADD_PARTICIPANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        /**
                         * Add participants into cache
                         */
                        if (canUseCache && cacheSecret.length > 0) {
                            if (db) {
                                var cacheData = [];

                                for (var i = 0; i < messageContent.participants.length; i++) {
                                    try {
                                        var tempData = {},
                                            salt = Utility.generateUUID();

                                        tempData.id = messageContent.participants[i].id;
                                        tempData.owner = userInfo.id;
                                        tempData.threadId = messageContent.id;
                                        tempData.notSeenDuration = messageContent.participants[i].notSeenDuration;
                                        tempData.admin = messageContent.participants[i].admin;
                                        tempData.auditor = messageContent.participants[i].auditor;
                                        tempData.name = Utility.crypt(messageContent.participants[i].name, cacheSecret, salt);
                                        tempData.contactName = Utility.crypt(messageContent.participants[i].contactName, cacheSecret, salt);
                                        tempData.email = Utility.crypt(messageContent.participants[i].email, cacheSecret, salt);
                                        tempData.expireTime = new Date().getTime() + cacheExpireTime;
                                        tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(messageContent.participants[i])), cacheSecret, salt);
                                        tempData.salt = salt;

                                        cacheData.push(tempData);
                                    } catch (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    }
                                }

                                db.participants.bulkPut(cacheData)
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [messageContent.id]
                            }, function (threadsResult) {
                                var threads = threadsResult.result.threads;

                                if (!threadsResult.cache) {
                                    fireEvent('threadEvents', {
                                        type: 'THREAD_ADD_PARTICIPANTS',
                                        result: {
                                            thread: threads[0]
                                        }
                                    });

                                    fireEvent('threadEvents', {
                                        type: 'THREAD_LAST_ACTIVITY_TIME',
                                        result: {
                                            thread: threads[0]
                                        }
                                    });
                                }
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_ADD_PARTICIPANTS',
                                result: {
                                    thread: messageContent
                                }
                            });

                            fireEvent('threadEvents', {
                                type: 'THREAD_LAST_ACTIVITY_TIME',
                                result: {
                                    thread: messageContent
                                }
                            });
                        }
                        break;

                    /**
                     * Type 13    Get Contacts List
                     */
                    case chatMessageVOTypes.GET_CONTACTS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 14    Get Threads List
                     */
                    case chatMessageVOTypes.GET_THREADS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount, uniqueId));
                        }
                        break;

                    /**
                     * Type 15    Get Message History of an Thread
                     */
                    case chatMessageVOTypes.GET_HISTORY:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 17    Remove sb from thread
                     */
                    case chatMessageVOTypes.REMOVED_FROM_THREAD:

                        fireEvent('threadEvents', {
                            type: 'THREAD_REMOVED_FROM',
                            result: {
                                thread: threadId
                            }
                        });

                        /**
                         * This user has been removed from a thread
                         * So we should delete thread, its participants
                         * and it's messages from this users cache
                         */
                        if (canUseCache) {
                            if (db) {
                                /**
                                 * Remove Thread from this users cache
                                 */
                                db.threads.where('[owner+id]')
                                    .equals([userInfo.id, threadId])
                                    .delete()
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });

                                /**
                                 * Remove all messages of the thread which this
                                 * user left
                                 */
                                db.messages.where('threadId')
                                    .equals(parseInt(threadId))
                                    .and(function (message) {
                                        return message.owner === userInfo.id;
                                    })
                                    .delete()
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });

                                /**
                                 * Remove all participants of the thread which
                                 * this user left
                                 */
                                db.participants.where('threadId')
                                    .equals(parseInt(threadId))
                                    .and(function (participant) {
                                        return participant.owner === userInfo.id;
                                    })
                                    .delete()
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });

                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                        break;

                    /**
                     * Type 18    Remove a participant from Thread
                     */
                    case chatMessageVOTypes.REMOVE_PARTICIPANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        /**
                         * Remove the participant from cache
                         */
                        if (canUseCache) {
                            if (db) {
                                for (var i = 0; i < messageContent.length; i++) {
                                    db.participants.where('id')
                                        .equals(parseInt(messageContent[i].id))
                                        .and(function (participants) {
                                            return participants.threadId === threadId;
                                        })
                                        .delete()
                                        .catch(function (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        });
                                }
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [threadId]
                            }, function (threadsResult) {
                                var threads = threadsResult.result.threads;

                                if (!threadsResult.cache) {
                                    fireEvent('threadEvents', {
                                        type: 'THREAD_REMOVE_PARTICIPANTS',
                                        result: {
                                            thread: threads[0]
                                        }
                                    });

                                    fireEvent('threadEvents', {
                                        type: 'THREAD_LAST_ACTIVITY_TIME',
                                        result: {
                                            thread: threads[0]
                                        }
                                    });
                                }
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_REMOVE_PARTICIPANTS',
                                result: {
                                    thread: threadId
                                }
                            });

                            fireEvent('threadEvents', {
                                type: 'THREAD_LAST_ACTIVITY_TIME',
                                result: {
                                    thread: threadId
                                }
                            });
                        }
                        break;

                    /**
                     * Type 19    Mute Thread
                     */
                    case chatMessageVOTypes.MUTE_THREAD:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [threadId]
                            }, function (threadsResult) {
                                var thread = threadsResult.result.threads[0];
                                thread.mute = true;

                                fireEvent('threadEvents', {
                                    type: 'THREAD_MUTE',
                                    result: {
                                        thread: thread
                                    }
                                });
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_MUTE',
                                result: {
                                    thread: threadId
                                }
                            });
                        }

                        break;

                    /**
                     * Type 20    Unmute muted Thread
                     */
                    case chatMessageVOTypes.UNMUTE_THREAD:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [threadId]
                            }, function (threadsResult) {
                                var thread = threadsResult.result.threads[0];
                                thread.mute = false;

                                fireEvent('threadEvents', {
                                    type: 'THREAD_UNMUTE',
                                    result: {
                                        thread: thread
                                    }
                                });
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_UNMUTE',
                                result: {
                                    thread: threadId
                                }
                            });
                        }
                        break;

                    /**
                     * Type 21    Update Thread Info
                     */
                    case chatMessageVOTypes.UPDATE_THREAD_INFO:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [messageContent.id],
                                cache: false
                            }, function (threadsResult) {
                                var thread = formatDataToMakeConversation(threadsResult.result.threads[0]);

                                /**
                                 * Add Updated Thread into cache database #cache
                                 */
                                if (canUseCache && cacheSecret.length > 0) {
                                    if (db) {
                                        var tempData = {};

                                        try {
                                            var salt = Utility.generateUUID();

                                            tempData.id = thread.id;
                                            tempData.owner = userInfo.id;
                                            tempData.title = Utility.crypt(thread.title, cacheSecret, salt);
                                            tempData.time = thread.time;
                                            tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(thread)), cacheSecret, salt);
                                            tempData.salt = salt;
                                        } catch (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        }

                                        db.threads.put(tempData)
                                            .catch(function (error) {
                                                fireEvent('error', {
                                                    code: error.code,
                                                    message: error.message,
                                                    error: error
                                                });
                                            });
                                    } else {
                                        fireEvent('error', {
                                            code: 6601,
                                            message: CHAT_ERRORS[6601],
                                            error: null
                                        });
                                    }
                                }

                                fireEvent('threadEvents', {
                                    type: 'THREAD_INFO_UPDATED',
                                    result: {
                                        thread: thread
                                    }
                                });
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_INFO_UPDATED',
                                result: {
                                    thread: messageContent
                                }
                            });
                        }
                        break;

                    /**
                     * Type 22    Forward Multiple Messages
                     */
                    case chatMessageVOTypes.FORWARD_MESSAGE:
                        newMessageHandler(threadId, messageContent);
                        break;

                    /**
                     * Type 23    User Info
                     */
                    case chatMessageVOTypes.USER_INFO:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('systemEvents', {
                            type: 'SERVER_TIME',
                            result: {
                                time: time
                            }
                        });

                        break;

                    /**
                     * Type 25    Get Blocked List
                     */
                    case chatMessageVOTypes.GET_BLOCKED:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 27    Thread Participants List
                     */
                    case chatMessageVOTypes.THREAD_PARTICIPANTS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 28    Edit Message
                     */
                    case chatMessageVOTypes.EDIT_MESSAGE:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        chatEditMessageHandler(threadId, messageContent);
                        break;

                    /**
                     * Type 29    Delete Message
                     */
                    case chatMessageVOTypes.DELETE_MESSAGE:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        if (messageContent.pinned) {
                            unPinMessage({
                                messageId: messageContent.id,
                                notifyAll: true
                            });
                        }
                        /**
                         * Remove Message from cache
                         */
                        if (canUseCache && cacheSecret.length > 0) {
                            if (db) {
                                db.messages.where('id')
                                    .equals(messageContent)
                                    .and(function (message) {
                                        return message.owner === userInfo.id;
                                    })
                                    .delete()
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: 6602,
                                            message: CHAT_ERRORS[6602],
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [threadId]
                            }, function (threadsResult) {
                                var threads = threadsResult.result.threads;
                                if (!threadsResult.cache) {
                                    fireEvent('messageEvents', {
                                        type: 'MESSAGE_DELETE',
                                        result: {
                                            message: {
                                                id: messageContent.id,
                                                pinned: messageContent.pinned,
                                                threadId: threadId
                                            }
                                        }
                                    });
                                    if (messageContent.pinned) {
                                        fireEvent('threadEvents', {
                                            type: 'THREAD_LAST_ACTIVITY_TIME',
                                            result: {
                                                thread: threads[0]
                                            }
                                        });
                                    }
                                }
                            });
                        } else {
                            fireEvent('messageEvents', {
                                type: 'MESSAGE_DELETE',
                                result: {
                                    message: {
                                        id: messageContent.id,
                                        pinned: messageContent.pinned,
                                        threadId: threadId
                                    }
                                }
                            });
                            if (messageContent.pinned) {
                                fireEvent('threadEvents', {
                                    type: 'THREAD_LAST_ACTIVITY_TIME',
                                    result: {
                                        thread: threadId
                                    }
                                });
                            }
                        }

                        break;

                    /**
                     * Type 30    Thread Info Updated
                     */
                    case chatMessageVOTypes.THREAD_INFO_UPDATED:
                        // TODO: Check this line again
                        // if (!messageContent.conversation && !messageContent.conversation.id) {
                        //     messageContent.conversation.id = threadId;
                        // }
                        //
                        // var thread = formatDataToMakeConversation(messageContent.conversation);
                        var thread = formatDataToMakeConversation(messageContent);

                        /**
                         * Add Updated Thread into cache database #cache
                         */
                        // if (canUseCache && cacheSecret.length > 0) {
                        //     if (db) {
                        //         var tempData = {};
                        //
                        //         try {
                        //             var salt = Utility.generateUUID();
                        //
                        //             tempData.id = thread.id;
                        //             tempData.owner = userInfo.id;
                        //             tempData.title = Utility.crypt(thread.title, cacheSecret, salt);
                        //             tempData.time = thread.time;
                        //             tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(thread)), cacheSecret, salt);
                        //             tempData.salt = salt;
                        //         }
                        //         catch (error) {
                        //             fireEvent('error', {
                        //                 code: error.code,
                        //                 message: error.message,
                        //                 error: error
                        //             });
                        //         }
                        //
                        //         db.threads.put(tempData)
                        //             .catch(function (error) {
                        //                 fireEvent('error', {
                        //                     code: error.code,
                        //                     message: error.message,
                        //                     error: error
                        //                 });
                        //             });
                        //     }
                        //     else {
                        //         fireEvent('error', {
                        //             code: 6601,
                        //             message: CHAT_ERRORS[6601],
                        //             error: null
                        //         });
                        //     }
                        // }
                        fireEvent('threadEvents', {
                            type: 'THREAD_INFO_UPDATED',
                            result: {
                                thread: thread
                            }
                        });
                        break;

                    /**
                     * Type 31    Thread Last Seen Updated
                     */
                    case chatMessageVOTypes.LAST_SEEN_UPDATED:
                        var threadObject = messageContent;
                        threadObject.unreadCount = (messageContent.unreadCount) ? messageContent.unreadCount : 0;

                        fireEvent('threadEvents', {
                            type: 'THREAD_UNREAD_COUNT_UPDATED',
                            result: {
                                thread: threadObject,
                                unreadCount: (messageContent.unreadCount) ? messageContent.unreadCount : 0
                            }
                        });

                        // if (fullResponseObject) {
                        //     getThreads({
                        //         threadIds: [messageContent.id]
                        //     }, function (threadsResult) {
                        //         var threads = threadsResult.result.threads;
                        //
                        //         if (!threadsResult.cache) {
                        //             fireEvent('threadEvents', {
                        //                 type: 'THREAD_UNREAD_COUNT_UPDATED',
                        //                 result: {
                        //                     thread: threads[0],
                        //                     unreadCount: (messageContent.unreadCount) ? messageContent.unreadCount : 0
                        //                 }
                        //             });
                        //
                        //             fireEvent('threadEvents', {
                        //                 type: 'THREAD_LAST_ACTIVITY_TIME',
                        //                 result: {
                        //                     thread: threads[0]
                        //                 }
                        //             });
                        //         }
                        //     });
                        // } else {
                        //     fireEvent('threadEvents', {
                        //         type: 'THREAD_UNREAD_COUNT_UPDATED',
                        //         result: {
                        //             thread: threadId,
                        //             unreadCount: (messageContent.unreadCount) ? messageContent.unreadCount : 0
                        //         }
                        //     });
                        //
                        //     fireEvent('threadEvents', {
                        //         type: 'THREAD_LAST_ACTIVITY_TIME',
                        //         result: {
                        //             thread: threadId
                        //         }
                        //     });
                        // }

                        break;

                    /**
                     * Type 32    Get Message Delivered List
                     */
                    case chatMessageVOTypes.GET_MESSAGE_DELEVERY_PARTICIPANTS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 33    Get Message Seen List
                     */
                    case chatMessageVOTypes.GET_MESSAGE_SEEN_PARTICIPANTS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 34    Is Public Group Name Available?
                     */
                    case chatMessageVOTypes.IS_NAME_AVAILABLE:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 39    Join Public Group or Channel
                     */
                    case chatMessageVOTypes.JOIN_THREAD:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 40    Bot Messages
                     */
                    case chatMessageVOTypes.BOT_MESSAGE:
                        fireEvent('botEvents', {
                            type: 'BOT_MESSAGE',
                            result: {
                                bot: messageContent
                            }
                        });
                        break;

                    /**
                     * Type 41    Spam P2P Thread
                     */
                    case chatMessageVOTypes.SPAM_PV_THREAD:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }
                        break;

                    /**
                     * Type 42    Set Role To User
                     */
                    case chatMessageVOTypes.SET_ROLE_TO_USER:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [messageContent.id]
                            }, function (threadsResult) {
                                var threads = threadsResult.result.threads;

                                if (!threadsResult.cache) {
                                    fireEvent('threadEvents', {
                                        type: 'THREAD_ADD_ADMIN',
                                        result: {
                                            thread: threads[0],
                                            admin: messageContent
                                        }
                                    });

                                    fireEvent('threadEvents', {
                                        type: 'THREAD_LAST_ACTIVITY_TIME',
                                        result: {
                                            thread: threads[0],
                                            admin: messageContent
                                        }
                                    });
                                }
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_ADD_ADMIN',
                                result: {
                                    thread: threadId,
                                    admin: messageContent
                                }
                            });

                            fireEvent('threadEvents', {
                                type: 'THREAD_LAST_ACTIVITY_TIME',
                                result: {
                                    thread: threadId,
                                    admin: messageContent
                                }
                            });
                        }

                        break;

                    /**
                     * Type 43    Remove Role From User
                     */
                    case chatMessageVOTypes.REMOVE_ROLE_FROM_USER:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [messageContent.id]
                            }, function (threadsResult) {
                                var threads = threadsResult.result.threads;

                                if (!threadsResult.cache) {
                                    fireEvent('threadEvents', {
                                        type: 'THREAD_REMOVE_ADMIN',
                                        result: {
                                            thread: threads[0],
                                            admin: messageContent
                                        }
                                    });

                                    fireEvent('threadEvents', {
                                        type: 'THREAD_LAST_ACTIVITY_TIME',
                                        result: {
                                            thread: threads[0],
                                            admin: messageContent
                                        }
                                    });
                                }
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_REMOVE_ADMIN',
                                result: {
                                    thread: threadId,
                                    admin: messageContent
                                }
                            });

                            fireEvent('threadEvents', {
                                type: 'THREAD_LAST_ACTIVITY_TIME',
                                result: {
                                    thread: threadId,
                                    admin: messageContent
                                }
                            });
                        }

                        break;

                    /**
                     * Type 44    Clear History
                     */
                    case chatMessageVOTypes.CLEAR_HISTORY:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }
                        break;

                    /**
                     * Type 46    System Messages
                     */
                    case chatMessageVOTypes.SYSTEM_MESSAGE:
                        fireEvent('systemEvents', {
                            type: 'IS_TYPING',
                            result: {
                                thread: threadId,
                                user: messageContent
                            }
                        });
                        break;

                    /**
                     * Type 47    Get Not Seen Duration
                     */
                    case chatMessageVOTypes.GET_NOT_SEEN_DURATION:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }
                        break;

                    /**
                     * Type 48    Pin Thread
                     */
                    case chatMessageVOTypes.PIN_THREAD:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [threadId]
                            }, function (threadsResult) {
                                var thread = threadsResult.result.threads[0];

                                fireEvent('threadEvents', {
                                    type: 'THREAD_PIN',
                                    result: {
                                        thread: thread
                                    }
                                });
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_PIN',
                                result: {
                                    thread: threadId
                                }
                            });
                        }

                        break;

                    /**
                     * Type 49    UnPin Thread
                     */
                    case chatMessageVOTypes.UNPIN_THREAD:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [threadId]
                            }, function (threadsResult) {
                                var thread = threadsResult.result.threads[0];

                                fireEvent('threadEvents', {
                                    type: 'THREAD_UNPIN',
                                    result: {
                                        thread: thread
                                    }
                                });
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_UNPIN',
                                result: {
                                    thread: threadId
                                }
                            });
                        }

                        break;

                    /**
                     * Type 50    Pin Message
                     */
                    case chatMessageVOTypes.PIN_MESSAGE:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }
                        fireEvent('threadEvents', {
                            type: 'MESSAGE_PIN',
                            result: {
                                thread: threadId,
                                pinMessage: formatDataToMakePinMessage(threadId, messageContent)
                            }
                        });
                        break;

                    /**
                     * Type 51    UnPin Message
                     */
                    case chatMessageVOTypes.UNPIN_MESSAGE:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }
                        fireEvent('threadEvents', {
                            type: 'MESSAGE_UNPIN',
                            result: {
                                thread: threadId,
                                pinMessage: formatDataToMakePinMessage(threadId, messageContent)
                            }
                        });
                        break;

                    /**
                     * Type 52    Update Chat Profile
                     */
                    case chatMessageVOTypes.UPDATE_CHAT_PROFILE:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }
                        fireEvent('userEvents', {
                            type: 'CHAT_PROFILE_UPDATED',
                            result: {
                                user: messageContent
                            }
                        });
                        break;

                    /**
                     * Type 53    Change Thread Privacy
                     */
                    case chatMessageVOTypes.CHANGE_THREAD_PRIVACY:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('threadEvents', {
                            type: 'THREAD_PRIVACY_CHANGED',
                            result: {
                                thread: messageContent
                            }
                        });

                        break;

                    /**
                     * Type 54    Get Participant Roles
                     */
                    case chatMessageVOTypes.GET_PARTICIPANT_ROLES:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }
                        fireEvent('userEvents', {
                            type: 'GET_PARTICIPANT_ROLES',
                            result: {
                                roles: messageContent
                            }
                        });
                        break;

                    /**
                     * Type 60    Get Contact Not Seen Duration
                     */
                    case chatMessageVOTypes.GET_CONTACT_NOT_SEEN_DURATION:
                        fireEvent('contactEvents', {
                            type: 'CONTACTS_LAST_SEEN',
                            result: messageContent
                        });
                        break;

                    /**
                     * Type 61      Get All Unread Message Count
                     */
                    case chatMessageVOTypes.ALL_UNREAD_MESSAGE_COUNT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('systemEvents', {
                            type: 'ALL_UNREAD_MESSAGES_COUNT',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 62    Create Bot
                     */
                    case chatMessageVOTypes.CREATE_BOT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 63    Define Bot Commands
                     */
                    case chatMessageVOTypes.DEFINE_BOT_COMMAND:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 64    Start Bot
                     */
                    case chatMessageVOTypes.START_BOT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 65    Stop Bot
                     */
                    case chatMessageVOTypes.STOP_BOT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 66    Last Message Deleted
                     */
                    case chatMessageVOTypes.LAST_MESSAGE_DELETED:
                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [messageContent.id]
                            }, function (threadsResult) {
                                var threads = threadsResult.result.threads;

                                if (!threadsResult.cache) {
                                    fireEvent('threadEvents', {
                                        type: 'THREAD_INFO_UPDATED',
                                        result: {
                                            thread: threads[0]
                                        }
                                    });
                                }
                            });
                        } else {
                            var thread = formatDataToMakeConversation(messageContent);

                            fireEvent('threadEvents', {
                                type: 'THREAD_INFO_UPDATED',
                                result: {
                                    thread: thread
                                }
                            });
                        }
                        break;

                    /**
                     * Type 67    Last Message Edited
                     */
                    case chatMessageVOTypes.LAST_MESSAGE_EDITED:
                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [messageContent.id]
                            }, function (threadsResult) {
                                var threads = threadsResult.result.threads;

                                if (!threadsResult.cache) {
                                    fireEvent('threadEvents', {
                                        type: 'THREAD_INFO_UPDATED',
                                        result: {
                                            thread: threads[0]
                                        }
                                    });
                                }
                            });
                        } else {
                            var thread = formatDataToMakeConversation(messageContent);

                            fireEvent('threadEvents', {
                                type: 'THREAD_INFO_UPDATED',
                                result: {
                                    thread: thread
                                }
                            });
                        }
                        break;

                    /**
                     * Type 68    Get Bot Commands List
                     */
                    case chatMessageVOTypes.BOT_COMMANDS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 69    Get Thread All Bots
                     */
                    case chatMessageVOTypes.THREAD_ALL_BOTS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 70    Send Call Request
                     */
                    case chatMessageVOTypes.CALL_REQUEST:
                        callReceived({
                            callId: messageContent.callId
                        }, function (r) {

                        });

                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'RECEIVE_CALL',
                            result: messageContent
                        });

                        currentCallId = messageContent.callId;

                        break;

                    /**
                     * Type 71    Accept Call Request
                     */
                    case chatMessageVOTypes.ACCEPT_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'ACCEPT_CALL',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 72    Reject Call Request
                     */
                    case chatMessageVOTypes.REJECT_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'REJECT_CALL',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 73    Receive Call Request
                     */
                    case chatMessageVOTypes.RECIVE_CALL_REQUEST:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        if (messageContent.callId > 0) {
                            fireEvent('callEvents', {
                                type: 'RECEIVE_CALL',
                                result: messageContent
                            });
                        }

                        currentCallId = messageContent.callId;

                        break;

                    /**
                     * Type 74    Start Call Request
                     */
                    case chatMessageVOTypes.START_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'CALL_STARTED',
                            result: messageContent
                        });

                        for (var peer in webpeers) {
                            if (webpeers[peer]) {
                                webpeers[peer].dispose();
                                delete webpeers[peer];
                            }
                        }
                        webpeers = {};

                        if (typeof messageContent === 'object'
                            && messageContent.hasOwnProperty('chatDataDto')
                            && !!messageContent.chatDataDto.kurentoAddress) {

                            setCallServerName(messageContent.chatDataDto.kurentoAddress.split(',')[0]);

                            startCallWebRTCFunctions({
                                video: messageContent.clientDTO.video,
                                mute: messageContent.clientDTO.mute,
                                sendingTopic: messageContent.clientDTO.topicSend,
                                receiveTopic: messageContent.clientDTO.topicReceive,
                                brokerAddress: messageContent.chatDataDto.brokerAddressWeb,
                                turnAddress: messageContent.chatDataDto.turnAddress,
                            }, function (callDivs) {
                                fireEvent('callEvents', {
                                    type: 'CALL_DIVS',
                                    result: callDivs
                                });
                            });
                        } else {
                            fireEvent('callEvents', {
                                type: 'CALL_ERROR',
                                message: 'Chat Data DTO is not present!'
                            });
                        }

                        break;

                    /**
                     * Type 75    End Call Request
                     */
                    case chatMessageVOTypes.END_CALL_REQUEST:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'END_CALL',
                            result: messageContent
                        });

                        callStop();

                        break;

                    /**
                     * Type 76   Call Ended
                     */
                    case chatMessageVOTypes.END_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'CALL_ENDED',
                            result: messageContent
                        });

                        callStop();

                        break;

                    /**
                     * Type 77    Get Calls History
                     */
                    case chatMessageVOTypes.GET_CALLS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        break;

                    /**
                     * Type 78    Call Partner Reconnecting
                     */
                    case chatMessageVOTypes.RECONNECT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'CALL_PARTICIPANT_RECONNETING',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 79    Call Partner Connects
                     */
                    case chatMessageVOTypes.CONNECT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'CALL_PARTICIPANT_CONNECTED',
                            result: messageContent
                        });

                        restartMedia(callTopics['sendVideoTopic']);

                        break;

                    /**
                     * Type 90    Contacts Synced
                     */
                    case chatMessageVOTypes.CONTACT_SYNCED:
                        fireEvent('contactEvents', {
                            type: 'CONTACTS_SYNCED',
                            result: messageContent
                        });
                        break;

                    /**
                     * Type 91    Send Group Call Request
                     */
                    case chatMessageVOTypes.GROUP_CALL_REQUEST:
                        callReceived({
                            callId: messageContent.callId
                        }, function (r) {
                        });

                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'RECEIVE_CALL',
                            result: messageContent
                        });

                        currentCallId = messageContent.callId;

                        break;

                    /**
                     * Type 92    Call Partner Leave
                     */
                    case chatMessageVOTypes.LEAVE_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'CALL_PARTICIPANT_LEFT',
                            result: messageContent
                        });

                        if (!!messageContent[0].sendTopic) {
                            removeFromCallUI(messageContent[0].sendTopic);
                        }

                        break;

                    /**
                     * Type 93    Add Call Participant
                     */
                    case chatMessageVOTypes.ADD_CALL_PARTICIPANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        break;

                    /**
                     * Type 94    Call Participant Joined
                     */
                    case chatMessageVOTypes.CALL_PARTICIPANT_JOINED:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'CALL_PARTICIPANT_JOINED',
                            result: messageContent
                        });

                        restartMedia(callTopics['sendVideoTopic']);

                        break;

                    /**
                     * Type 95    Remove Call Participant
                     */
                    case chatMessageVOTypes.REMOVE_CALL_PARTICIPANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'CALL_PARTICIPANT_REMOVED',
                            result: messageContent
                        });


                        break;

                    /**
                     * Type 96    Terminate Call
                     */
                    case chatMessageVOTypes.TERMINATE_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'TERMINATE_CALL',
                            result: messageContent
                        });

                        callStop();

                        break;

                    /**
                     * Type 97    Mute Call Participant
                     */
                    case chatMessageVOTypes.MUTE_CALL_PARTICIPANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'CALL_PARTICIPANT_MUTE',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 98    UnMute Call Participant
                     */
                    case chatMessageVOTypes.UNMUTE_CALL_PARTICIPANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'CALL_PARTICIPANT_UNMUTE',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 101    Location Ping
                     */
                    case chatMessageVOTypes.LOCATION_PING:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('systemEvents', {
                            type: 'LOCATION_PING',
                            result: messageContent
                        });
                        break;

                    /**
                     * Type 102    Close Thread
                     */
                    case chatMessageVOTypes.CLOSE_THREAD:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        if (fullResponseObject) {
                            getThreads({
                                threadIds: [threadId]
                            }, function (threadsResult) {
                                var thread = threadsResult.result.threads[0];
                                thread.mute = true;

                                fireEvent('threadEvents', {
                                    type: 'THREAD_CLOSE',
                                    result: {
                                        thread: thread
                                    }
                                });
                            });
                        } else {
                            fireEvent('threadEvents', {
                                type: 'THREAD_CLOSE',
                                result: {
                                    thread: threadId
                                }
                            });
                        }

                        break;

                    /**
                     * Type 104    Remove Bot Commands
                     */
                    case chatMessageVOTypes.REMOVE_BOT_COMMANDS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 107    Register Assistant
                     */
                    case chatMessageVOTypes.REGISTER_ASSISTANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('assistantEvents', {
                            type: 'ASSISTANT_REGISTER',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 108    Deactivate Assistant
                     */
                    case chatMessageVOTypes.DEACTIVATE_ASSISTANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('assistantEvents', {
                            type: 'ASSISTANT_DEACTIVATE',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 109    Get Assistants List
                     */
                    case chatMessageVOTypes.GET_ASSISTANTS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('assistantEvents', {
                            type: 'ASSISTANTS_LIST',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 110    Active Call Participants List
                     */
                    case chatMessageVOTypes.ACTIVE_CALL_PARTICIPANTS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }
                        break;

                    /**
                     * Type 111    Kafka Call Session Created
                     */
                    case chatMessageVOTypes.CALL_SESSION_CREATED:
                        fireEvent('callEvents', {
                            type: 'CALL_SESSION_CREATED',
                            result: messageContent
                        });

                        currentCallId = messageContent.callId;

                        break;

                    /**
                     * Type 113    Turn On Video Call
                     */
                    case chatMessageVOTypes.TURN_ON_VIDEO_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'TURN_ON_VIDEO_CALL',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 114    Turn Off Video Call
                     */
                    case chatMessageVOTypes.TURN_OFF_VIDEO_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'TURN_OFF_VIDEO_CALL',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 115    Get Assistants History
                     */
                    case chatMessageVOTypes.ASSISTANT_HISTORY:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('assistantEvents', {
                            type: 'ASSISTANTS_HSITORY',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 116    Block Assistants
                     */
                    case chatMessageVOTypes.BLOCK_ASSISTANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('assistantEvents', {
                            type: 'ASSISTANT_BLOCK',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 117    UnBlock Assistant
                     */
                    case chatMessageVOTypes.UNBLOCK_ASSISTANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('assistantEvents', {
                            type: 'ASSISTANT_UNBLOCK',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 118    Blocked Assistants List
                     */
                    case chatMessageVOTypes.BLOCKED_ASSISTANTS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('assistantEvents', {
                            type: 'ASSISTANTS_BLOCKED_LIST',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 121    Record Call Request
                     */
                    case chatMessageVOTypes.RECORD_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'START_RECORDING_CALL',
                            result: messageContent
                        });

                        restartMedia(callTopics['sendVideoTopic']);

                        break;

                    /**
                     * Type 122   End Record Call Request
                     */
                    case chatMessageVOTypes.END_RECORD_CALL:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'STOP_RECORDING_CALL',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 123   Start Screen Share
                     */
                    case chatMessageVOTypes.START_SCREEN_SHARE:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'START_SCREEN_SHARE',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 124   End Screen Share
                     */
                    case chatMessageVOTypes.END_SCREEN_SHARE:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('callEvents', {
                            type: 'END_SCREEN_SHARE',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 125   Delete From Call List
                     */
                    case chatMessageVOTypes.DELETE_FROM_CALL_HISTORY:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('callEvents', {
                            type: 'DELETE_FROM_CALL_LIST',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 130    Mutual Groups
                     */
                    case chatMessageVOTypes.MUTUAL_GROUPS:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent, contentCount));
                        }

                        fireEvent('threadEvents', {
                            type: 'MUTUAL_GROUPS',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 140    Create Tag
                     */
                    case chatMessageVOTypes.CREATE_TAG:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('threadEvents', {
                            type: 'NEW_TAG',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 141    Edit Tag
                     */
                    case chatMessageVOTypes.EDIT_TAG:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('threadEvents', {
                            type: 'EDIT_TAG',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 142    Delete Tag
                     */
                    case chatMessageVOTypes.DELETE_TAG:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('threadEvents', {
                            type: 'DELETE_TAG',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 143    Delete Tag
                     */
                    case chatMessageVOTypes.ADD_TAG_PARTICIPANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('threadEvents', {
                            type: 'ADD_TAG_PARTICIPANT',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 144    Delete Tag
                     */
                    case chatMessageVOTypes.REMOVE_TAG_PARTICIPANT:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('threadEvents', {
                            type: 'REMOVE_TAG_PARTICIPANT',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 145    Delete Tag
                     */
                    case chatMessageVOTypes.GET_TAG_LIST:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('threadEvents', {
                            type: 'TAG_LIST',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 151    Delete Message Thread
                     */
                    case chatMessageVOTypes.DELETE_MESSAGE_THREAD:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(false, '', 0, messageContent));
                        }

                        fireEvent('threadEvents', {
                            type: 'DELETE_THREAD',
                            result: messageContent
                        });

                        break;

                    /**
                     * Type 999   All unknown errors
                     */
                    case chatMessageVOTypes.ERROR:
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](Utility.createReturnData(true, messageContent.message, messageContent.code, messageContent, 0));
                        }

                        /**
                         * If error code is 21, Token is invalid &
                         * user should logged out
                         */
                        if (messageContent.code === 21) {
                            // TODO: Temporarily removed due to unknown side-effects
                            // chatState = false;
                            // asyncClient.logout();
                            // clearChatServerCaches();
                        }

                        /* If the error code is 208, so the user
                         * has been blocked cause of spam activity
                         */
                        if (messageContent.code === 208) {
                            if (sendMessageCallbacks[uniqueId]) {
                                getItemFromChatWaitQueue(uniqueId, function (message) {
                                    fireEvent('messageEvents', {
                                        type: 'MESSAGE_FAILED',
                                        cache: false,
                                        result: {
                                            message: message
                                        }
                                    });
                                });
                            }
                        }

                        fireEvent('error', {
                            code: messageContent.code,
                            message: messageContent.message,
                            error: messageContent,
                            uniqueId: uniqueId
                        });

                        break;
                }
            },

            callMessageHandler = function (callMessage) {
                var jsonMessage = (typeof callMessage.content === 'string' && isValidJson(callMessage.content))
                    ? JSON.parse(callMessage.content)
                    : callMessage.content,
                    uniqueId = jsonMessage.uniqueId;


                asyncRequestTimeouts[uniqueId] && clearTimeout(asyncRequestTimeouts[uniqueId]);

                switch (jsonMessage.id) {
                    case 'PROCESS_SDP_ANSWER':
                        handleProcessSdpAnswer(jsonMessage);
                        break;

                    case 'ADD_ICE_CANDIDATE':
                        handleAddIceCandidate(jsonMessage);
                        break;

                    case 'GET_KEY_FRAME':
                        setTimeout(function () {
                            restartMedia(callTopics['sendVideoTopic']);
                        }, 2000);
                        setTimeout(function () {
                            restartMedia(callTopics['sendVideoTopic']);
                        }, 4000);
                        setTimeout(function () {
                            restartMedia(callTopics['sendVideoTopic']);
                        }, 8000);
                        setTimeout(function () {
                            restartMedia(callTopics['sendVideoTopic']);
                        }, 12000);
                        break;

                    case 'FREEZED':
                        handlePartnerFreeze(jsonMessage);
                        break;

                    case 'STOPALL':
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](jsonMessage);
                        }
                        break;

                    case 'CLOSE':
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](jsonMessage);
                        }
                        break;

                    case 'SESSION_NEW_CREATED':
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](jsonMessage);
                        }
                        break;

                    case 'SESSION_REFRESH':
                        if (messagesCallbacks[uniqueId]) {
                            messagesCallbacks[uniqueId](jsonMessage);
                        }
                        break;

                    case 'ERROR':
                        handleError(jsonMessage, params.sendingTopic, params.receiveTopic);
                        break;

                    default:
                        console.warn("[onmessage] Invalid message, id: " + jsonMessage.id, jsonMessage);
                        if (jsonMessage.match(/NOT CREATE SESSION/g)) {
                            if (currentCallParams && Object.keys(currentCallParams)) {
                                handleCallSocketOpen(currentCallParams);
                            }
                        }
                        break;
                }
            },

            /**
             * Send Message Callbacks Handler
             *
             * When you send Delivery or Seen Acknowledgements of a message
             * You should send Delivery and Seen for all the Messages before
             * that message so that you wont have un delivered/unseen messages
             * after seeing the last message of a thread
             *
             * @access private
             *
             * @param {int}     actionType      Switch between Delivery or Seen
             * @param {int}    threadId        Id of thread
             * @param {string}  uniqueId        uniqueId of message
             *
             * @return {undefined}
             */
            sendMessageCallbacksHandler = function (actionType, threadId, uniqueId) {
                switch (actionType) {

                    case chatMessageVOTypes.DELIVERY:
                        if (threadCallbacks[threadId]) {
                            var lastThreadCallbackIndex = Object.keys(threadCallbacks[threadId])
                                .indexOf(uniqueId);
                            if (typeof lastThreadCallbackIndex !== 'undefined') {
                                while (lastThreadCallbackIndex > -1) {
                                    var tempUniqueId = Object.entries(threadCallbacks[threadId])[lastThreadCallbackIndex][0];
                                    if (sendMessageCallbacks[tempUniqueId] && sendMessageCallbacks[tempUniqueId].onDeliver) {
                                        if (threadCallbacks[threadId][tempUniqueId] && threadCallbacks[threadId][tempUniqueId].onSent) {
                                            sendMessageCallbacks[tempUniqueId].onDeliver(
                                                {
                                                    uniqueId: tempUniqueId
                                                });
                                            delete (sendMessageCallbacks[tempUniqueId].onDeliver);
                                            threadCallbacks[threadId][tempUniqueId].onDeliver = true;
                                        }
                                    }

                                    lastThreadCallbackIndex -= 1;
                                }
                            }
                        }
                        break;

                    case chatMessageVOTypes.SEEN:
                        if (threadCallbacks[threadId]) {
                            var lastThreadCallbackIndex = Object.keys(threadCallbacks[threadId])
                                .indexOf(uniqueId);
                            if (typeof lastThreadCallbackIndex !== 'undefined') {
                                while (lastThreadCallbackIndex > -1) {
                                    var tempUniqueId = Object.entries(threadCallbacks[threadId])[lastThreadCallbackIndex][0];

                                    if (sendMessageCallbacks[tempUniqueId] && sendMessageCallbacks[tempUniqueId].onSeen) {
                                        if (threadCallbacks[threadId][tempUniqueId] && threadCallbacks[threadId][tempUniqueId].onSent) {
                                            if (!threadCallbacks[threadId][tempUniqueId].onDeliver) {
                                                sendMessageCallbacks[tempUniqueId].onDeliver(
                                                    {
                                                        uniqueId: tempUniqueId
                                                    });
                                                delete (sendMessageCallbacks[tempUniqueId].onDeliver);
                                                threadCallbacks[threadId][tempUniqueId].onDeliver = true;
                                            }

                                            sendMessageCallbacks[tempUniqueId].onSeen(
                                                {
                                                    uniqueId: tempUniqueId
                                                });

                                            delete (sendMessageCallbacks[tempUniqueId].onSeen);
                                            threadCallbacks[threadId][tempUniqueId].onSeen = true;

                                            if (threadCallbacks[threadId][tempUniqueId].onSent &&
                                                threadCallbacks[threadId][tempUniqueId].onDeliver &&
                                                threadCallbacks[threadId][tempUniqueId].onSeen) {
                                                delete threadCallbacks[threadId][tempUniqueId];
                                                delete sendMessageCallbacks[tempUniqueId];
                                            }
                                        }
                                    }

                                    lastThreadCallbackIndex -= 1;
                                }
                            }
                        }
                        break;

                    default:
                        break;
                }
            },

            /**
             * New Message Handler
             *
             * Handles Event Emitter of a newly received Chat Message
             *
             * @access private
             *
             * @param {int}    threadId         ID of image
             * @param {object}  messageContent   Json Content of the message
             *
             * @return {undefined}
             */
            newMessageHandler = function (threadId, messageContent) {

                var message = formatDataToMakeMessage(threadId, messageContent);
                /*
                 * Send Message delivery for the last message
                 * has been received while being online
                 */
                // putInMessagesDeliveryQueue(threadId, message.id);

                /**
                 * Add New Messages into cache database
                 */
                if (canUseCache && cacheSecret.length > 0) {
                    if (db) {
                        /**
                         * Insert new messages into cache database
                         * after deleting old messages from cache
                         */
                        var tempData = {};

                        try {
                            var salt = Utility.generateUUID();
                            tempData.id = parseInt(message.id);
                            tempData.owner = parseInt(userInfo.id);
                            tempData.threadId = parseInt(message.threadId);
                            tempData.time = message.time;
                            tempData.message = Utility.crypt(message.message, cacheSecret, salt);
                            tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(message)), cacheSecret, salt);
                            tempData.salt = salt;
                            tempData.sendStatus = 'sent';

                        } catch (error) {
                            fireEvent('error', {
                                code: error.code,
                                message: error.message,
                                error: error
                            });
                        }

                        db.messages.put(tempData)
                            .catch(function (error) {
                                fireEvent('error', {
                                    code: error.code,
                                    message: error.message,
                                    error: error
                                });
                            });
                    } else {
                        fireEvent('error', {
                            code: 6601,
                            message: CHAT_ERRORS[6601],
                            error: null
                        });
                    }
                }

                fireEvent('messageEvents', {
                    type: 'MESSAGE_NEW',
                    cache: false,
                    result: {
                        message: message
                    }
                });

                var threadObject = message.conversation;
                var lastMessageVoCopy = Object.assign({}, message);
                lastMessageVoCopy.conversation && delete lastMessageVoCopy.conversation;

                threadObject.lastParticipantImage = (!!message.participant && message.participant.hasOwnProperty('image')) ? message.participant.image : '';
                threadObject.lastMessageVO = lastMessageVoCopy;
                threadObject.lastParticipantName = (!!message.participant && message.participant.hasOwnProperty('name')) ? message.participant.name : '';
                threadObject.lastMessage = (message.hasOwnProperty('message')) ? message.message : '';

                fireEvent('threadEvents', {
                    type: 'THREAD_UNREAD_COUNT_UPDATED',
                    result: {
                        thread: threadObject,
                        unreadCount: (threadObject.unreadCount) ? threadObject.unreadCount : 0
                    }
                });

                fireEvent('threadEvents', {
                    type: 'THREAD_LAST_ACTIVITY_TIME',
                    result: {
                        thread: threadObject
                    }
                });

                // if (fullResponseObject) {
                //     getThreads({
                //         threadIds: [threadId]
                //     }, function (threadsResult) {
                //         var threads = threadsResult.result.threads;
                //
                //         fireEvent('threadEvents', {
                //             type: 'THREAD_UNREAD_COUNT_UPDATED',
                //             result: {
                //                 thread: threads[0],
                //                 unreadCount: (threads[0].unreadCount) ? threads[0].unreadCount : 0
                //             }
                //         });
                //
                //         fireEvent('threadEvents', {
                //             type: 'THREAD_LAST_ACTIVITY_TIME',
                //             result: {
                //                 thread: threads[0]
                //             }
                //         });
                //
                //     });
                // } else {
                //     fireEvent('threadEvents', {
                //         type: 'THREAD_LAST_ACTIVITY_TIME',
                //         result: {
                //             thread: threadId
                //         }
                //     });
                //
                //     fireEvent('threadEvents', {
                //         type: 'THREAD_UNREAD_COUNT_UPDATED',
                //         result: {
                //             thread: messageContent.id,
                //             unreadCount: (messageContent.conversation.unreadCount) ? messageContent.conversation.unreadCount : 0
                //         }
                //     });
                // }

                /**
                 * Update waitQ and remove sent messages from it
                 */

                deleteFromChatWaitQueue(message, function () {
                });
            },

            /**
             * Chat Edit Message Handler
             *
             * Handles Event Emitter of an edited Chat Message
             *
             * @access private
             *
             * @param {int}    threadId         ID of image
             * @param {object}  messageContent   Json Content of the message
             *
             * @return {undefined}
             */
            chatEditMessageHandler = function (threadId, messageContent) {
                var message = formatDataToMakeMessage(threadId, messageContent);

                /**
                 * Update Message on cache
                 */
                if (canUseCache && cacheSecret.length > 0) {
                    if (db) {
                        try {
                            var tempData = {},
                                salt = Utility.generateUUID();
                            tempData.id = parseInt(message.id);
                            tempData.owner = parseInt(userInfo.id);
                            tempData.threadId = parseInt(message.threadId);
                            tempData.time = message.time;
                            tempData.message = Utility.crypt(message.message, cacheSecret, salt);
                            tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(message)), cacheSecret, salt);
                            tempData.salt = salt;

                            /**
                             * Insert Message into cache database
                             */
                            db.messages.put(tempData)
                                .catch(function (error) {
                                    fireEvent('error', {
                                        code: error.code,
                                        message: error.message,
                                        error: error
                                    });
                                });
                        } catch (error) {
                            fireEvent('error', {
                                code: error.code,
                                message: error.message,
                                error: error
                            });
                        }
                    } else {
                        fireEvent('error', {
                            code: 6601,
                            message: CHAT_ERRORS[6601],
                            error: null
                        });
                    }
                }

                if (fullResponseObject) {
                    getThreads({
                        threadIds: [threadId]
                    }, function (threadsResult) {
                        var threads = threadsResult.result.threads;
                        if (!threadsResult.cache) {
                            fireEvent('messageEvents', {
                                type: 'MESSAGE_EDIT',
                                result: {
                                    message: message
                                }
                            });
                            if (message.pinned) {
                                fireEvent('threadEvents', {
                                    type: 'THREAD_LAST_ACTIVITY_TIME',
                                    result: {
                                        thread: threads[0]
                                    }
                                });
                            }
                        }
                    });
                } else {
                    fireEvent('messageEvents', {
                        type: 'MESSAGE_EDIT',
                        result: {
                            message: message
                        }
                    });
                    if (message.pinned) {
                        fireEvent('threadEvents', {
                            type: 'THREAD_LAST_ACTIVITY_TIME',
                            result: {
                                thread: threadId
                            }
                        });
                    }
                }

            },

            /**
             * Create Thread
             *
             * Makes formatted Thread Object out of given contentCount,
             * If Thread has been newly created, a THREAD_NEW event
             * will be emitted
             *
             * @access private
             *
             * @param {object}    messageContent    Json object of thread taken from chat server
             * @param {boolean}   addFromService    if this is a newly created Thread, addFromService should be True
             *
             * @param showThread
             * @return {object} Formatted Thread Object
             */
            createThread = function (messageContent, addFromService, showThread) {
                var threadData = formatDataToMakeConversation(messageContent);
                var redirectToThread = (showThread === true) ? showThread : false;

                if (addFromService) {
                    fireEvent('threadEvents', {
                        type: 'THREAD_NEW',
                        redirectToThread: redirectToThread,
                        result: {
                            thread: threadData
                        }
                    });

                    /**
                     * Add New Thread into cache database #cache
                     */
                    if (canUseCache && cacheSecret.length > 0) {
                        if (db) {
                            var tempData = {};

                            try {
                                var salt = Utility.generateUUID();

                                tempData.id = threadData.id;
                                tempData.owner = userInfo.id;
                                tempData.title = Utility.crypt(threadData.title, cacheSecret, salt);
                                tempData.time = threadData.time;
                                tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(threadData)), cacheSecret, salt);
                                tempData.salt = salt;
                            } catch (error) {
                                fireEvent('error', {
                                    code: error.code,
                                    message: error.message,
                                    error: error
                                });
                            }

                            db.threads.put(tempData)
                                .catch(function (error) {
                                    fireEvent('error', {
                                        code: error.code,
                                        message: error.message,
                                        error: error
                                    });
                                });
                        } else {
                            fireEvent('error', {
                                code: 6601,
                                message: CHAT_ERRORS[6601],
                                error: null
                            });
                        }
                    }
                }
                return threadData;
            },

            /**
             * Format Data To Make Linked User
             *
             * This functions re-formats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @return {object} linkedUser Object
             */
            formatDataToMakeLinkedUser = function (messageContent) {
                /**
                 * + RelatedUserVO                 {object}
                 *   - coreUserId                  {int}
                 *   - username                    {string}
                 *   - nickname                    {string}
                 *   - name                        {string}
                 *   - image                       {string}
                 */

                var linkedUser = {
                    coreUserId: (typeof messageContent.coreUserId !== 'undefined')
                        ? messageContent.coreUserId
                        : messageContent.id,
                    username: messageContent.username,
                    nickname: messageContent.nickname,
                    name: messageContent.name,
                    image: messageContent.image
                };

                // return linkedUser;
                return JSON.parse(JSON.stringify(linkedUser));
            },

            /**
             * Format Data To Make Contact
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @return {object} contact Object
             */
            formatDataToMakeContact = function (messageContent) {
                /**
                 * + ContactVO                        {object}
                 *    - id                            {int}
                 *    - blocked                       {boolean}
                 *    - userId                        {int}
                 *    - firstName                     {string}
                 *    - lastName                      {string}
                 *    - image                         {string}
                 *    - email                         {string}
                 *    - cellphoneNumber               {string}
                 *    - uniqueId                      {string}
                 *    - notSeenDuration               {int}
                 *    - hasUser                       {boolean}
                 *    - linkedUser                    {object : RelatedUserVO}
                 */

                var contact = {
                    id: messageContent.id,
                    blocked: (typeof messageContent.blocked !== 'undefined')
                        ? messageContent.blocked
                        : false,
                    userId: messageContent.userId,
                    firstName: messageContent.firstName,
                    lastName: messageContent.lastName,
                    image: messageContent.profileImage,
                    email: messageContent.email,
                    cellphoneNumber: messageContent.cellphoneNumber,
                    uniqueId: messageContent.uniqueId,
                    notSeenDuration: messageContent.notSeenDuration,
                    hasUser: messageContent.hasUser,
                    linkedUser: undefined
                };

                if (typeof messageContent.linkedUser !== 'undefined') {
                    contact.linkedUser = formatDataToMakeLinkedUser(messageContent.linkedUser);
                }

                // return contact;
                return JSON.parse(JSON.stringify(contact));
            },

            /**
             * Format Data To Make User
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @return {object} user Object
             */
            formatDataToMakeUser = function (messageContent) {
                /**
                 * + User                     {object}
                 *    - id                    {int}
                 *    - name                  {string}
                 *    - email                 {string}
                 *    - cellphoneNumber       {string}
                 *    - image                 {string}
                 *    - lastSeen              {int}
                 *    - sendEnable            {boolean}
                 *    - receiveEnable         {boolean}
                 *    - contactSynced         {boolean}
                 *    - chatProfileVO         {object:chatProfileVO}
                 */

                var user = {
                    id: messageContent.id,
                    coreUserId: messageContent.coreUserId,
                    username: messageContent.username,
                    name: messageContent.name,
                    email: messageContent.email,
                    cellphoneNumber: messageContent.cellphoneNumber,
                    image: messageContent.image,
                    lastSeen: messageContent.lastSeen,
                    sendEnable: messageContent.sendEnable,
                    receiveEnable: messageContent.receiveEnable,
                    contactSynced: messageContent.contactSynced
                };

                if (messageContent.contactId) {
                    user.contactId = messageContent.contactId;
                }

                if (messageContent.contactName) {
                    user.contactName = messageContent.contactName;
                }

                if (messageContent.contactFirstName) {
                    user.contactFirstName = messageContent.contactFirstName;
                }

                if (messageContent.contactLastName) {
                    user.contactLastName = messageContent.contactLastName;
                }

                if (messageContent.blocked) {
                    user.blocked = messageContent.blocked;
                }

                // Add chatProfileVO if exist
                if (messageContent.chatProfileVO) {
                    user.chatProfileVO = messageContent.chatProfileVO;
                }

                // return user;
                return JSON.parse(JSON.stringify(user));
            },

            /**
             * Format Data To Make Blocked User
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @return {object} blockedUser Object
             */
            formatDataToMakeBlockedUser = function (messageContent) {
                /**
                 * + BlockedUser              {object}
                 *    - id                    {int}
                 *    - coreUserId            {int}
                 *    - firstName             {string}
                 *    - lastName              {string}
                 *    - nickName              {string}
                 *    - profileImage          {string}
                 *    - contact               {object: contactVO}
                 */

                var blockedUser = {
                    blockId: messageContent.id,
                    coreUserId: messageContent.coreUserId,
                    firstName: messageContent.firstName,
                    lastName: messageContent.lastName,
                    nickName: messageContent.nickName,
                    profileImage: messageContent.profileImage
                };

                // Add contactVO if exist
                if (messageContent.contactVO) {
                    blockedUser.contact = messageContent.contactVO;
                }
                // return blockedUser;
                return JSON.parse(JSON.stringify(blockedUser));
            },

            formatDataToMakeAssistanthistoryItem = function (messageContent) {

                var assistant = {
                    actionType: Object.keys(assistantActionTypes)[Object.values(assistantActionTypes).indexOf(messageContent.actionType)],
                    actionTime: messageContent.actionTime
                };

                // Add chatProfileVO if exist
                if (messageContent.participantVO) {
                    assistant.participantVO = messageContent.participantVO;
                }

                // return participant;
                return JSON.parse(JSON.stringify(assistant));
            },

            formatDataToMakeAssistantHistoryList = function (assistantsList) {
                var returnData = [];

                for (var i = 0; i < assistantsList.length; i++) {
                    returnData.push(formatDataToMakeAssistanthistoryItem(assistantsList[i]));
                }

                return returnData;
            },

            /**
             * Format Data To Make Invitee
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @return {object} inviteeData Object
             */
            formatDataToMakeInvitee = function (messageContent) {
                /**
                 * + InviteeVO       {object}
                 *    - id           {string}
                 *    - idType       {int}
                 */

                return {
                    id: messageContent.id,
                    idType: inviteeVOidTypes[messageContent.idType]
                };
            },

            /**
             * Format Data To Make Participant
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @param threadId
             * @return {object} participant Object
             */
            formatDataToMakeParticipant = function (messageContent, threadId) {
                /**
                 * + ParticipantVO                   {object}
                 *    - id                           {int}
                 *    - coreUserId                   {int}
                 *    - threadId                     {int}
                 *    - sendEnable                   {boolean}
                 *    - receiveEnable                {boolean}
                 *    - firstName                    {string}
                 *    - lastName                     {string}
                 *    - name                         {string}
                 *    - cellphoneNumber              {string}
                 *    - email                        {string}
                 *    - image                        {string}
                 *    - chatProfileVO                {object}
                 *    - myFriend                     {boolean}
                 *    - online                       {boolean}
                 *    - notSeenDuration              {int}
                 *    - contactId                    {int}
                 *    - contactName                  {string}
                 *    - contactFirstName             {string}
                 *    - contactLastName              {string}
                 *    - blocked                      {boolean}
                 *    - admin                        {boolean}
                 *    - auditor                      {boolean}
                 *    - keyId                        {string}
                 *    - roles                        {list:string}
                 *    - username                     {string}
                 */

                var participant = {
                    id: messageContent.id,
                    coreUserId: messageContent.coreUserId,
                    threadId: parseInt(threadId),
                    sendEnable: messageContent.sendEnable,
                    receiveEnable: messageContent.receiveEnable,
                    firstName: messageContent.firstName,
                    lastName: messageContent.lastName,
                    name: messageContent.name,
                    cellphoneNumber: messageContent.cellphoneNumber,
                    email: messageContent.email,
                    image: messageContent.image,
                    myFriend: messageContent.myFriend,
                    online: messageContent.online,
                    notSeenDuration: messageContent.notSeenDuration,
                    contactId: messageContent.contactId,
                    contactName: messageContent.contactName,
                    contactFirstName: messageContent.contactFirstName,
                    contactLastName: messageContent.contactLastName,
                    blocked: messageContent.blocked,
                    admin: messageContent.admin,
                    auditor: messageContent.auditor,
                    keyId: messageContent.keyId,
                    roles: messageContent.roles,
                    username: messageContent.username
                };

                // Add chatProfileVO if exist
                if (messageContent.chatProfileVO) {
                    participant.chatProfileVO = messageContent.chatProfileVO;
                }

                // return participant;
                return JSON.parse(JSON.stringify(participant));
            },

            /**
             * Format Data To Make Call Participant
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @param threadId
             * @return {object} participant Object
             */
            formatDataToMakeCallParticipant = function (messageContent) {
                /**
                 * + CallParticipantVO                   {object}
                 *    - id                           {int}
                 *    - joinTime                     {int}
                 *    - leaveTime                    {int}
                 *    - threadParticipant            {object}
                 *    - sendTopic                    {string}
                 *    - receiveTopic                 {string}
                 *    - brokerAddress                {string}
                 *    - active                       {boolean}
                 *    - callSession                  {object}
                 *    - callStatus                   {int}
                 *    - createTime                   {int}
                 *    - sendKey                      {string}
                 *    - mute                         {boolean}
                 */

                var participant = {
                    id: messageContent.id,
                    joinTime: messageContent.joinTime,
                    leaveTime: messageContent.leaveTime,
                    sendTopic: messageContent.sendTopic,
                    receiveTopic: messageContent.receiveTopic,
                    brokerAddress: messageContent.brokerAddress,
                    active: messageContent.active,
                    callSession: messageContent.callSession,
                    callStatus: messageContent.callStatus,
                    createTime: messageContent.createTime,
                    sendKey: messageContent.sendKey,
                    mute: messageContent.mute
                };

                // Add Chat Participant if exist
                if (messageContent.participantVO) {
                    participant.participantVO = messageContent.participantVO;
                }

                // Add Call Session if exist
                if (messageContent.callSession) {
                    participant.callSession = messageContent.callSession;
                }

                // return participant;
                return JSON.parse(JSON.stringify(participant));
            },

            /**
             * Format Data To Make Conversation
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @return {object} Conversation Object
             */
            formatDataToMakeConversation = function (messageContent) {

                /**
                 * + Conversation                           {object}
                 *    - id                                  {int}
                 *    - joinDate                            {int}
                 *    - title                               {string}
                 *    - inviter                             {object : ParticipantVO}
                 *    - participants                        {list : ParticipantVO}
                 *    - time                                {int}
                 *    - lastMessage                         {string}
                 *    - lastParticipantName                 {string}
                 *    - group                               {boolean}
                 *    - partner                             {int}
                 *    - lastParticipantImage                {string}
                 *    - image                               {string}
                 *    - description                         {string}
                 *    - unreadCount                         {int}
                 *    - lastSeenMessageId                   {int}
                 *    - lastSeenMessageTime                 {int}
                 *    - lastSeenMessageNanos                {integer}
                 *    - lastMessageVO                       {object : ChatMessageVO}
                 *    - pinMessageVO                        {object : pinMessageVO}
                 *    - partnerLastSeenMessageId            {int}
                 *    - partnerLastSeenMessageTime          {int}
                 *    - partnerLastSeenMessageNanos         {integer}
                 *    - partnerLastDeliveredMessageId       {int}
                 *    - partnerLastDeliveredMessageTime     {int}
                 *    - partnerLastDeliveredMessageNanos    {integer}
                 *    - type                                {int}
                 *    - metadata                            {string}
                 *    - mute                                {boolean}
                 *    - participantCount                    {int}
                 *    - canEditInfo                         {boolean}
                 *    - canSpam                             {boolean}
                 *    - admin                               {boolean}
                 *    - mentioned                           {boolean}
                 *    - pin                                 {boolean}
                 *    - uniqueName                          {string}
                 *    - userGroupHash                       {string}
                 *    - leftWithHistory                     {boolean}
                 *    - closed                              {boolean}
                 */

                var conversation = {
                    id: messageContent.id,
                    joinDate: messageContent.joinDate,
                    title: messageContent.title,
                    inviter: undefined,
                    participants: undefined,
                    time: messageContent.time,
                    lastMessage: messageContent.lastMessage,
                    lastParticipantName: messageContent.lastParticipantName,
                    group: messageContent.group,
                    partner: messageContent.partner,
                    lastParticipantImage: messageContent.lastParticipantImage,
                    image: messageContent.image,
                    description: messageContent.description,
                    unreadCount: messageContent.unreadCount,
                    lastSeenMessageId: messageContent.lastSeenMessageId,
                    lastSeenMessageTime: (messageContent.lastSeenMessageNanos)
                        ? (parseInt(parseInt(messageContent.lastSeenMessageTime) / 1000) * 1000000000) + parseInt(messageContent.lastSeenMessageNanos)
                        : (parseInt(messageContent.lastSeenMessageTime)),
                    lastMessageVO: undefined,
                    pinMessageVO: undefined,
                    partnerLastSeenMessageId: messageContent.partnerLastSeenMessageId,
                    partnerLastSeenMessageTime: (messageContent.partnerLastSeenMessageNanos)
                        ? (parseInt(parseInt(messageContent.partnerLastSeenMessageTime) / 1000) * 1000000000) +
                        parseInt(messageContent.partnerLastSeenMessageNanos)
                        : (parseInt(messageContent.partnerLastSeenMessageTime)),
                    partnerLastDeliveredMessageId: messageContent.partnerLastDeliveredMessageId,
                    partnerLastDeliveredMessageTime: (messageContent.partnerLastDeliveredMessageNanos)
                        ? (parseInt(parseInt(messageContent.partnerLastDeliveredMessageTime) / 1000) * 1000000000) +
                        parseInt(messageContent.partnerLastDeliveredMessageNanos)
                        : (parseInt(messageContent.partnerLastDeliveredMessageTime)),
                    type: messageContent.type,
                    metadata: messageContent.metadata,
                    mute: messageContent.mute,
                    participantCount: messageContent.participantCount,
                    canEditInfo: messageContent.canEditInfo,
                    canSpam: messageContent.canSpam,
                    admin: messageContent.admin,
                    mentioned: messageContent.mentioned,
                    pin: messageContent.pin,
                    uniqueName: messageContent.uniqueName,
                    userGroupHash: messageContent.userGroupHash,
                    leftWithHistory: messageContent.leftWithHistory,
                    closed: messageContent.closed
                };

                // Add inviter if exist
                if (messageContent.inviter) {
                    conversation.inviter = formatDataToMakeParticipant(messageContent.inviter, messageContent.id);
                }

                // Add participants list if exist
                if (messageContent.participants && Array.isArray(messageContent.participants)) {
                    conversation.participants = [];

                    for (var i = 0; i < messageContent.participants.length; i++) {
                        var participantData = formatDataToMakeParticipant(messageContent.participants[i], messageContent.id);
                        if (participantData) {
                            conversation.participants.push(participantData);
                        }
                    }
                }

                // Add lastMessageVO if exist
                if (messageContent.lastMessageVO) {
                    conversation.lastMessageVO = formatDataToMakeMessage(messageContent.id, messageContent.lastMessageVO);
                }

                // Add pinMessageVO if exist
                if (messageContent.pinMessageVO) {
                    conversation.pinMessageVO = formatDataToMakePinMessage(messageContent.id, messageContent.pinMessageVO);
                }

                // return conversation;
                return JSON.parse(JSON.stringify(conversation));
            },

            /**
             * Format Data To Make Reply Info
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @param threadId
             * @return {object} replyInfo Object
             */
            formatDataToMakeReplyInfo = function (messageContent, threadId) {
                /**
                 * + replyInfoVO                  {object : replyInfoVO}
                 *   - participant                {object : ParticipantVO}
                 *   - repliedToMessageId         {int}
                 *   - repliedToMessageTime       {int}
                 *   - repliedToMessageNanos      {int}
                 *   - message                    {string}
                 *   - deleted                    {boolean}
                 *   - messageType                {int}
                 *   - metadata                   {string}
                 *   - systemMetadata             {string}
                 */

                var replyInfo = {
                    participant: undefined,
                    repliedToMessageId: messageContent.repliedToMessageId,
                    repliedToMessageTime: (messageContent.repliedToMessageNanos)
                        ? (parseInt(parseInt(messageContent.repliedToMessageTime) / 1000) * 1000000000) + parseInt(messageContent.repliedToMessageNanos)
                        : (parseInt(messageContent.repliedToMessageTime)),
                    repliedToMessageTimeMiliSeconds: parseInt(messageContent.repliedToMessageTime),
                    repliedToMessageTimeNanos: parseInt(messageContent.repliedToMessageNanos),
                    message: messageContent.message,
                    deleted: messageContent.deleted,
                    messageType: messageContent.messageType,
                    metadata: messageContent.metadata,
                    systemMetadata: messageContent.systemMetadata
                };

                if (messageContent.participant) {
                    replyInfo.participant = formatDataToMakeParticipant(messageContent.participant, threadId);
                }

                // return replyInfo;
                return JSON.parse(JSON.stringify(replyInfo));
            },

            /**
             * Format Data To Make Forward Info
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @param threadId
             * @return {object} forwardInfo Object
             */
            formatDataToMakeForwardInfo = function (messageContent, threadId) {
                /**
                 * + forwardInfo                  {object : forwardInfoVO}
                 *   - participant                {object : ParticipantVO}
                 *   - conversation               {object : ConversationSummary}
                 */

                var forwardInfo = {
                    participant: undefined,
                    conversation: undefined
                };

                if (messageContent.conversation) {
                    forwardInfo.conversation = formatDataToMakeConversation(messageContent.conversation);
                }

                if (messageContent.participant) {
                    forwardInfo.participant = formatDataToMakeParticipant(messageContent.participant, threadId);
                }

                // return forwardInfo;
                return JSON.parse(JSON.stringify(forwardInfo));
            },

            /**
             * Format Data To Make Message
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             *
             * @return {object} message Object
             * @param threadId
             * @param pushMessageVO
             * @param fromCache
             */
            formatDataToMakeMessage = function (threadId, pushMessageVO, fromCache) {
                /**
                 * + MessageVO                       {object}
                 *    - id                           {int}
                 *    - threadId                     {int}
                 *    - ownerId                      {int}
                 *    - uniqueId                     {string}
                 *    - previousId                   {int}
                 *    - message                      {string}
                 *    - messageType                  {int}
                 *    - edited                       {boolean}
                 *    - editable                     {boolean}
                 *    - deletable                    {boolean}
                 *    - delivered                    {boolean}
                 *    - seen                         {boolean}
                 *    - mentioned                    {boolean}
                 *    - pinned                       {boolean}
                 *    - participant                  {object : ParticipantVO}
                 *    - conversation                 {object : ConversationVO}
                 *    - replyInfo                    {object : replyInfoVO}
                 *    - forwardInfo                  {object : forwardInfoVO}
                 *    - metadata                     {string}
                 *    - systemMetadata               {string}
                 *    - time                         {int}
                 *    - timeNanos                    {int}
                 */

                if (fromCache || pushMessageVO.time.toString().length > 14) {
                    var time = pushMessageVO.time,
                        timeMiliSeconds = parseInt(pushMessageVO.time / 1000000);
                } else {
                    var time = (pushMessageVO.timeNanos)
                        ? (parseInt(parseInt(pushMessageVO.time) / 1000) * 1000000000) + parseInt(pushMessageVO.timeNanos)
                        : (parseInt(pushMessageVO.time)),
                        timeMiliSeconds = parseInt(pushMessageVO.time);
                }

                var message = {
                    id: pushMessageVO.id,
                    threadId: threadId,
                    ownerId: (pushMessageVO.ownerId)
                        ? pushMessageVO.ownerId
                        : undefined,
                    uniqueId: pushMessageVO.uniqueId,
                    previousId: pushMessageVO.previousId,
                    message: pushMessageVO.message,
                    messageType: pushMessageVO.messageType,
                    edited: pushMessageVO.edited,
                    editable: pushMessageVO.editable,
                    deletable: pushMessageVO.deletable,
                    delivered: pushMessageVO.delivered,
                    seen: pushMessageVO.seen,
                    mentioned: pushMessageVO.mentioned,
                    pinned: pushMessageVO.pinned,
                    participant: undefined,
                    conversation: undefined,
                    replyInfo: undefined,
                    forwardInfo: undefined,
                    metadata: pushMessageVO.metadata,
                    systemMetadata: pushMessageVO.systemMetadata,
                    time: time,
                    timeMiliSeconds: timeMiliSeconds,
                    timeNanos: parseInt(pushMessageVO.timeNanos)
                };

                if (pushMessageVO.participant) {
                    message.ownerId = pushMessageVO.participant.id;
                }

                if (pushMessageVO.conversation) {
                    message.conversation = formatDataToMakeConversation(pushMessageVO.conversation);
                    message.threadId = pushMessageVO.conversation.id;
                }

                if (pushMessageVO.replyInfoVO || pushMessageVO.replyInfo) {
                    message.replyInfo = (pushMessageVO.replyInfoVO)
                        ? formatDataToMakeReplyInfo(pushMessageVO.replyInfoVO, threadId)
                        : formatDataToMakeReplyInfo(pushMessageVO.replyInfo, threadId);
                }

                if (pushMessageVO.forwardInfo) {
                    message.forwardInfo = formatDataToMakeForwardInfo(pushMessageVO.forwardInfo, threadId);
                }

                if (pushMessageVO.participant) {
                    message.participant = formatDataToMakeParticipant(pushMessageVO.participant, threadId);
                }

                // return message;
                return JSON.parse(JSON.stringify(message));
            },

            /**
             * Format Data To Make Pin Message
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @return {object} pin message Object
             */
            formatDataToMakePinMessage = function (threadId, pushMessageVO) {
                /**
                 * + PinMessageVO                    {object}
                 *    - messageId                    {int}
                 *    - time                         {int}
                 *    - sender                       {int}
                 *    - text                         {string}
                 *    - notifyAll                    {boolean}
                 */
                var pinMessage = {
                    threadId: threadId,
                    time: pushMessageVO.time,
                    sender: pushMessageVO.sender,
                    messageId: pushMessageVO.messageId,
                    text: pushMessageVO.text
                };

                if (typeof pushMessageVO.notifyAll === 'boolean') {
                    pinMessage.notifyAll = pushMessageVO.notifyAll
                }

                // return pinMessage;
                return JSON.parse(JSON.stringify(pinMessage));
            },

            /**
             * Format Data To Make Call Message
             *
             * This functions reformats given JSON to proper Object
             *
             * @access private
             *
             * @param {object}  messageContent    Json object of thread taken from chat server
             *
             * @return {object} Call message Object
             */
            formatDataToMakeCallMessage = function (threadId, pushMessageVO) {
                /**
                 * + CallVO                   {object}
                 *    - id                    {int}
                 *    - creatorId             {int}
                 *    - type                  {int}
                 *    - createTime            {string}
                 *    - startTime             {string}
                 *    - endTime               {string}
                 *    - status                {int}
                 *    - isGroup               {boolean}
                 *    - callParticipants      {object}
                 *    - partnerParticipantVO  {object}
                 *    - conversationVO        {object}
                 */
                var callMessage = {
                    id: pushMessageVO.id,
                    creatorId: pushMessageVO.creatorId,
                    type: pushMessageVO.type,
                    createTime: pushMessageVO.createTime,
                    startTime: pushMessageVO.startTime,
                    endTime: pushMessageVO.endTime,
                    status: pushMessageVO.status,
                    isGroup: pushMessageVO.isGroup,
                    callParticipants: pushMessageVO.callParticipants,
                    partnerParticipantVO: pushMessageVO.partnerParticipantVO,
                    conversationVO: pushMessageVO.conversationVO
                };

                // return pinMessage;
                return JSON.parse(JSON.stringify(callMessage));
            },

            /**
             * Reformat Thread History
             *
             * This functions reformats given Array of thread Messages
             * into proper chat message object
             *
             * @access private
             *
             * @param {int}    threadId         Id of Thread
             * @param {object}  historyContent   Array of Thread History Messages
             *
             * @return {object} Formatted Thread History
             */
            reformatThreadHistory = function (threadId, historyContent) {
                var returnData = [];

                for (var i = 0; i < historyContent.length; i++) {
                    returnData.push(formatDataToMakeMessage(threadId, historyContent[i]));
                }

                return returnData;
            },

            /**
             * Reformat Thread Participants
             *
             * This functions reformats given Array of thread Participants
             * into proper thread participant
             *
             * @access private
             *
             * @param {object}  participantsContent   Array of Thread Participant Objects
             * @param {int}    threadId              Id of Thread
             *
             * @return {object} Formatted Thread Participant Array
             */
            reformatThreadParticipants = function (participantsContent, threadId) {
                var returnData = [];

                for (var i = 0; i < participantsContent.length; i++) {
                    returnData.push(formatDataToMakeParticipant(participantsContent[i], threadId));
                }

                return returnData;
            },

            /**
             * Reformat Call Participants
             *
             * This functions reformats given Array of call Participants
             * into proper call participant
             *
             * @access private
             *
             * @param {object}  participantsContent   Array of Call Participant Objects
             * @param {int}    threadId              Id of call
             *
             * @return {object} Formatted Call Participant Array
             */
            reformatCallParticipants = function (participantsContent) {
                var returnData = [];

                for (var i = 0; i < participantsContent.length; i++) {
                    returnData.push(formatDataToMakeCallParticipant(participantsContent[i]));
                }

                return returnData;
            },

            /**
             * Unset Not Seen Duration
             *
             * This functions unsets notSeenDuration property of cached objects
             *
             * @access private
             *
             * @param {object}  content   Object or Array to be modified
             *
             * @return {object}
             */
            unsetNotSeenDuration = function (content) {
                /**
                 * Make a copy from original object to modify it's
                 * attributes, because we don't want to change
                 * the original object
                 */
                var temp = cloneObject(content);

                if (temp.hasOwnProperty('notSeenDuration')) {
                    temp.notSeenDuration = undefined;
                }

                if (temp.hasOwnProperty('inviter')) {
                    temp.inviter.notSeenDuration = undefined;
                }

                if (temp.hasOwnProperty('participant')) {
                    temp.participant.notSeenDuration = undefined;
                }

                return temp;
            },

            /**
             * Clone Object/Array
             *
             * This functions makes a deep clone of given object or array
             *
             * @access private
             *
             * @param {object}  original   Object or Array to be cloned
             *
             * @return {object} Cloned object
             */
            cloneObject = function (original) {
                var out, value, key;
                out = Array.isArray(original) ? [] : {};

                for (key in original) {
                    value = original[key];
                    out[key] = (typeof value === 'object' && value !== null)
                        ? cloneObject(value)
                        : value;
                }

                return out;
            },

            /**
             * Get Treads.
             *
             * This functions gets threads list
             *
             * @access private
             *
             * @param {int}       count                 count of threads to be received
             * @param {int}       offset                offset of select query
             * @param {array}     threadIds             An array of thread ids to be received
             * @param {string}    name                  Search term to look up in thread Titles
             * @param {int}      creatorCoreUserId     SSO User Id of thread creator
             * @param {int}      partnerCoreUserId     SSO User Id of thread partner
             * @param {int}      partnerCoreContactId  Contact Id of thread partner
             * @param {function}  callback              The callback function to call after
             *
             * @return {object} Instant sendMessage result
             */
            getThreads = function (params, callback) {
                var count = 50,
                    offset = 0,
                    content = {},
                    whereClause = {},
                    returnCache = false;

                if (params) {
                    if (parseInt(params.count) > 0) {
                        count = params.count;
                    }

                    if (parseInt(params.offset) > 0) {
                        offset = params.offset;
                    }

                    if (typeof params.threadName === 'string') {
                        content.name = whereClause.name = params.threadName;
                    }

                    if (Array.isArray(params.threadIds)) {
                        content.threadIds = whereClause.threadIds = params.threadIds;
                    }

                    if (typeof params.new === 'boolean') {
                        content.new = params.new;
                    }

                    if (parseInt(params.creatorCoreUserId) > 0) {
                        content.creatorCoreUserId = whereClause.creatorCoreUserId = params.creatorCoreUserId;
                    }

                    if (parseInt(params.partnerCoreUserId) > 0) {
                        content.partnerCoreUserId = whereClause.partnerCoreUserId = params.partnerCoreUserId;
                    }

                    if (parseInt(params.partnerCoreContactId) > 0) {
                        content.partnerCoreContactId = whereClause.partnerCoreContactId = params.partnerCoreContactId;
                    }

                    var functionLevelCache = (typeof params.cache == 'boolean') ? params.cache : true;
                }

                content.count = count;
                content.offset = offset;

                var sendMessageParams = {
                    chatMessageVOType: chatMessageVOTypes.GET_THREADS,
                    typeCode: params.typeCode,
                    content: content
                };

                /**
                 * Retrieve threads from cache
                 */
                if (functionLevelCache && canUseCache && cacheSecret.length > 0) {
                    if (db) {
                        var thenAble;

                        if (Object.keys(whereClause).length === 0) {
                            thenAble = db.threads.where('[owner+time]')
                                .between([userInfo.id, minIntegerValue], [userInfo.id, maxIntegerValue * 1000])
                                .reverse();
                        } else {
                            if (whereClause.hasOwnProperty('threadIds')) {
                                thenAble = db.threads.where('id')
                                    .anyOf(whereClause.threadIds)
                                    .and(function (thread) {
                                        return thread.owner === userInfo.id;
                                    });
                            }

                            if (whereClause.hasOwnProperty('name')) {
                                thenAble = db.threads.where('owner')
                                    .equals(parseInt(userInfo.id))
                                    .filter(function (thread) {
                                        var reg = new RegExp(whereClause.name);
                                        return reg.test(chatDecrypt(thread.title, cacheSecret, thread.salt));
                                    });
                            }

                            if (whereClause.hasOwnProperty('creatorCoreUserId')) {
                                thenAble = db.threads.where('owner')
                                    .equals(parseInt(userInfo.id))
                                    .filter(function (thread) {
                                        var threadObject = JSON.parse(chatDecrypt(thread.data, cacheSecret, thread.salt), false);
                                        return parseInt(threadObject.inviter.coreUserId) === parseInt(whereClause.creatorCoreUserId);
                                    });
                            }
                        }

                        thenAble.offset(offset)
                            .limit(count)
                            .toArray()
                            .then(function (threads) {
                                db.threads.where('owner')
                                    .equals(parseInt(userInfo.id))
                                    .count()
                                    .then(function (threadsCount) {
                                        var cacheData = [];

                                        for (var i = 0; i < threads.length; i++) {
                                            try {
                                                cacheData.push(createThread(JSON.parse(chatDecrypt(threads[i].data, cacheSecret, threads[i].salt)), false));
                                            } catch (error) {
                                                fireEvent('error', {
                                                    code: error.code,
                                                    message: error.message,
                                                    error: error
                                                });
                                            }
                                        }

                                        var returnData = {
                                            hasError: false,
                                            cache: true,
                                            errorCode: 0,
                                            errorMessage: '',
                                            result: {
                                                threads: cacheData,
                                                contentCount: threadsCount,
                                                hasNext: !(threads.length < count),
                                                nextOffset: offset * 1 + threads.length
                                            }
                                        };

                                        if (cacheData.length > 0) {
                                            callback && callback(returnData);
                                            callback = undefined;
                                            returnCache = true;
                                        }
                                    });
                            })
                            .catch(function (error) {
                                fireEvent('error', {
                                    code: error.code,
                                    message: error.message,
                                    error: error
                                });
                            });
                    } else {
                        fireEvent('error', {
                            code: 6601,
                            message: CHAT_ERRORS[6601],
                            error: null
                        });
                    }
                }

                /**
                 * Retrive get threads response from server
                 */
                return sendMessage(sendMessageParams, {
                    onResult: function (result) {
                        var returnData = {
                            hasError: result.hasError,
                            cache: false,
                            errorMessage: result.errorMessage,
                            errorCode: result.errorCode,
                            uniqueId: result.uniqueId
                        };

                        if (!returnData.hasError) {

                            var messageContent = result.result,
                                messageLength = messageContent.length,
                                resultData = {
                                    threads: [],
                                    contentCount: result.contentCount,
                                    hasNext: (offset + count < result.contentCount && messageLength > 0),
                                    nextOffset: offset * 1 + messageLength * 1
                                },
                                threadData;

                            for (var i = 0; i < messageLength; i++) {
                                threadData = createThread(messageContent[i], false);
                                if (threadData) {
                                    resultData.threads.push(threadData);
                                }
                            }

                            returnData.result = resultData;

                            /**
                             * Updating cache on separated worker to find and
                             * delete all messages that have been deleted from
                             * thread's last section
                             */

                            if (typeof Worker !== 'undefined' && productEnv !== 'ReactNative' && canUseCache && cacheSecret.length > 0) {
                                if (typeof cacheSyncWorker === 'undefined') {
                                    var plainWorker = function () {
                                        self.importScripts('https://npmcdn.com/dexie@2.0.4/dist/dexie.min.js');
                                        db = new Dexie('podChat');

                                        db.version(1)
                                            .stores({
                                                users: '&id, name, cellphoneNumber, keyId',
                                                contacts: '[owner+id], id, owner, uniqueId, userId, cellphoneNumber, email, firstName, lastName, expireTime',
                                                threads: '[owner+id] ,id, owner, title, time, pin, [owner+time]',
                                                participants: '[owner+id], id, owner, threadId, notSeenDuration, admin, name, contactName, email, expireTime',
                                                messages: '[owner+id], id, owner, threadId, time, [threadId+id], [threadId+owner+time]',
                                                messageGaps: '[owner+id], [owner+waitsFor], id, waitsFor, owner, threadId, time, [threadId+owner+time]',
                                                contentCount: 'threadId, contentCount'
                                            });

                                        addEventListener('message', function (event) {
                                            var data = JSON.parse(event.data);

                                            switch (data.type) {
                                                case 'getThreads':
                                                    var content = JSON.parse(data.data),
                                                        userId = parseInt(data.userId);
                                                    for (var i = 0; i < content.length; i++) {
                                                        var lastMessageTime = (content[i].lastMessageVO) ? content[i].lastMessageVO.time : 0,
                                                            threadId = parseInt(content[i].id);
                                                        if (lastMessageTime > 0) {
                                                            db.messages
                                                                .where('[threadId+owner+time]')
                                                                .between([threadId, userId, lastMessageTime], [
                                                                    threadId,
                                                                    userId,
                                                                    Number.MAX_SAFE_INTEGER * 1000], false, true)
                                                                .delete();
                                                        }
                                                    }
                                                    break;
                                            }
                                        }, false);
                                    };
                                    var code = plainWorker.toString();
                                    code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'));
                                    var blob = new Blob([code], {type: 'application/javascript'});
                                    cacheSyncWorker = new Worker(URL.createObjectURL(blob));
                                }

                                var workerCommand = {
                                    type: 'getThreads',
                                    userId: userInfo.id,
                                    data: JSON.stringify(resultData.threads)
                                };

                                cacheSyncWorker.postMessage(JSON.stringify(workerCommand));

                                cacheSyncWorker.onmessage = function (event) {
                                    if (event.data === 'terminate') {
                                        cacheSyncWorker.terminate();
                                        cacheSyncWorker = undefined;
                                    }
                                };

                                cacheSyncWorker.onerror = function (event) {
                                    consoleLogging && console.log(event);
                                };
                            }

                            /**
                             * Add Threads into cache database #cache
                             */
                            if (canUseCache && cacheSecret.length > 0) {
                                if (db) {
                                    var cacheData = [];

                                    /*
                                     * There will be only 5 pinned threads
                                     * So we multiply thread time by pin
                                     * order to have them ordered on cache
                                     * by the same order of server
                                     */
                                    var pinnedThreadsOrderTime = 5;

                                    for (var i = 0; i < resultData.threads.length; i++) {
                                        try {
                                            var tempData = {},
                                                salt = Utility.generateUUID();

                                            tempData.id = resultData.threads[i].id;
                                            tempData.owner = userInfo.id;
                                            tempData.title = Utility.crypt(resultData.threads[i].title, cacheSecret, salt);
                                            tempData.pin = resultData.threads[i].pin;
                                            tempData.time = (resultData.threads[i].pin) ? resultData.threads[i].time * pinnedThreadsOrderTime : resultData.threads[i].time;
                                            tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(resultData.threads[i])), cacheSecret, salt);
                                            tempData.salt = salt;

                                            cacheData.push(tempData);
                                            pinnedThreadsOrderTime--;
                                        } catch (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        }
                                    }

                                    db.threads.bulkPut(cacheData)
                                        .catch(function (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        });
                                } else {
                                    fireEvent('error', {
                                        code: 6601,
                                        message: CHAT_ERRORS[6601],
                                        error: null
                                    });
                                }
                            }
                        }

                        callback && callback(returnData);
                        /**
                         * Delete callback so if server pushes response before
                         * cache, cache won't send data again
                         */
                        callback = undefined;

                        if (!returnData.hasError && returnCache) {
                            fireEvent('threadEvents', {
                                type: 'THREADS_LIST_CHANGE',
                                result: returnData.result
                            });
                        }
                    }
                });
            },

            getAllThreads = function (params, callback) {
                var sendMessageParams = {
                    chatMessageVOType: chatMessageVOTypes.GET_THREADS,
                    typeCode: params.typeCode,
                    content: {}
                };

                sendMessageParams.content.summary = params.summary;

                return sendMessage(sendMessageParams, {
                    onResult: function (result) {

                        if (!result.hasError) {
                            if (canUseCache) {
                                if (db) {
                                    var allThreads = [];
                                    for (var m = 0; m < result.result.length; m++) {
                                        allThreads.push(result.result[m].id);
                                    }
                                    db.threads
                                        .where('owner')
                                        .equals(parseInt(userInfo.id))
                                        .and(function (thread) {
                                            return allThreads.indexOf(thread.id) < 0;
                                        })
                                        .delete()
                                        .catch(function (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        });
                                } else {
                                    fireEvent('error', {
                                        code: 6601,
                                        message: CHAT_ERRORS[6601],
                                        error: null
                                    });
                                }
                            }
                        }

                        callback && callback(result);
                    }
                });
            },

            /**
             * Get History.
             *
             * This functions gets history of a thread
             *
             * @access private
             *
             * @param {int}       count             Count of threads to be received
             * @param {int}       offset            Offset of select query
             * @param {int}      threadId          Id of thread to get its history
             * @param {int}      id                Id of single message to get
             * @param {int}      userId            Messages of this SSO User
             * @param {int}       messageType       Type of messages to get (types should be set by client)
             * @param {int}      fromTime          Get messages which have bigger time than given fromTime
             * @param {int}       fromTimeNanos     Get messages which have bigger time than given fromTimeNanos
             * @param {int}      toTime            Get messages which have smaller time than given toTime
             * @param {int}       toTimeNanos       Get messages which have smaller time than given toTimeNanos
             * @param {int}      senderId          Messages of this sender only
             * @param {string}    uniqueIds         Array of unique ids to retrieve
             * @param {string}    order             Order of select query (default: DESC)
             * @param {string}    query             Search term to be looked up in messages content
             * @param {object}    metadataCriteria  This JSON will be used to search in message metadata with GraphQL
             * @param {function}  callback          The callback function to call after
             *
             * @return {object} Instant result of sendMessage
             */
            getHistory = function (params, callback) {
                if (parseInt(params.threadId) > 0) {
                    var sendMessageParams = {
                            chatMessageVOType: chatMessageVOTypes.GET_HISTORY,
                            typeCode: params.typeCode,
                            content: {},
                            subjectId: params.threadId
                        },
                        whereClause = {},
                        offset = (parseInt(params.offset) > 0) ? parseInt(params.offset) : 0,
                        count = (parseInt(params.count) > 0) ? parseInt(params.count) : config.getHistoryCount,
                        order = (typeof params.order != 'undefined') ? (params.order).toLowerCase() : 'desc',
                        functionLevelCache = (typeof params.cache == 'boolean') ? params.cache : true,
                        cacheResult = {},
                        serverResult = {},
                        cacheFirstMessage,
                        cacheLastMessage,
                        messages,
                        returnCache,
                        cacheReady = false,
                        dynamicHistoryCount = (params.dynamicHistoryCount && typeof params.dynamicHistoryCount === 'boolean')
                            ? params.dynamicHistoryCount
                            : false,
                        sendingQueue = (params.queues && typeof params.queues.sending === 'boolean')
                            ? params.queues.sending
                            : true,
                        failedQueue = (params.queues && typeof params.queues.failed === 'boolean')
                            ? params.queues.failed
                            : true,
                        uploadingQueue = (params.queues && typeof params.queues.uploading === 'boolean')
                            ? params.queues.uploading
                            : true,
                        sendingQueueMessages = [],
                        failedQueueMessages = [],
                        uploadingQueueMessages = [];

                    if (sendingQueue) {
                        getChatSendQueue(parseInt(params.threadId), function (sendQueueMessages) {
                            for (var i = 0; i < sendQueueMessages.length; i++) {
                                var time = new Date().getTime();

                                sendingQueueMessages.push(formatDataToMakeMessage(sendQueueMessages[i].threadId, {
                                    uniqueId: sendQueueMessages[i].uniqueId,
                                    ownerId: userInfo.id,
                                    message: sendQueueMessages[i].content,
                                    metadata: sendQueueMessages[i].metadata,
                                    systemMetadata: sendQueueMessages[i].systemMetadata,
                                    replyInfo: sendQueueMessages[i].replyInfo,
                                    forwardInfo: sendQueueMessages[i].forwardInfo,
                                    time: time,
                                    timeNanos: (time % 1000) * 1000000
                                }));
                            }
                        });
                    }


                    if (uploadingQueue) {
                        getChatUploadQueue(parseInt(params.threadId), function (uploadQueueMessages) {
                            for (var i = 0; i < uploadQueueMessages.length; i++) {
                                uploadQueueMessages[i].message.participant = userInfo;
                                var time = new Date().getTime();
                                uploadQueueMessages[i].message.time = time;
                                uploadQueueMessages[i].message.timeNanos = (time % 1000) * 1000000;
                                uploadingQueueMessages.push(formatDataToMakeMessage(params.threadId, uploadQueueMessages[i].message, false));
                            }
                        });
                    }

                    getChatWaitQueue(parseInt(params.threadId), failedQueue, function (waitQueueMessages) {
                        if (cacheSecret.length > 0) {
                            for (var i = 0; i < waitQueueMessages.length; i++) {
                                var decryptedEnqueuedMessage = {};

                                if (cacheInMemory) {
                                    decryptedEnqueuedMessage = waitQueueMessages[i];
                                } else {
                                    decryptedEnqueuedMessage = Utility.jsonParser(chatDecrypt(waitQueueMessages[i].message, cacheSecret));
                                }

                                var time = new Date().getTime();
                                failedQueueMessages[i] = formatDataToMakeMessage(waitQueueMessages[i].threadId,
                                    {
                                        uniqueId: decryptedEnqueuedMessage.uniqueId,
                                        ownerId: userInfo.id,
                                        message: decryptedEnqueuedMessage.content,
                                        metadata: decryptedEnqueuedMessage.metadata,
                                        systemMetadata: decryptedEnqueuedMessage.systemMetadata,
                                        replyInfo: decryptedEnqueuedMessage.replyInfo,
                                        forwardInfo: decryptedEnqueuedMessage.forwardInfo,
                                        participant: userInfo,
                                        time: time,
                                        timeNanos: (time % 1000) * 1000000
                                    }
                                );
                            }
                        } else {
                            failedQueueMessages = [];
                        }

                        if (dynamicHistoryCount) {
                            var tempCount = count - (sendingQueueMessages.length + failedQueueMessages.length + uploadingQueueMessages.length);
                            sendMessageParams.content.count = (tempCount > 0) ? tempCount : 0;
                        } else {
                            sendMessageParams.content.count = count;
                        }

                        sendMessageParams.content.offset = offset;
                        sendMessageParams.content.order = order;

                        if (parseInt(params.messageId) > 0) {
                            sendMessageParams.content.id = whereClause.id = params.messageId;
                        }

                        if (Array.isArray(params.uniqueIds)) {
                            sendMessageParams.content.uniqueIds = params.uniqueIds;
                        }

                        if (parseInt(params.fromTimeFull) > 0 && params.fromTimeFull.toString().length === 19) {
                            sendMessageParams.content.fromTime = whereClause.fromTime = parseInt(params.fromTimeFull.toString()
                                .substring(0, 13));
                            sendMessageParams.content.fromTimeNanos = whereClause.fromTimeNanos = parseInt(params.fromTimeFull.toString()
                                .substring(10, 19));
                        } else {
                            if (parseInt(params.fromTime) > 0 && parseInt(params.fromTime) < 9999999999999) {
                                sendMessageParams.content.fromTime = whereClause.fromTime = parseInt(params.fromTime);
                            }

                            if (parseInt(params.fromTimeNanos) > 0 && parseInt(params.fromTimeNanos) < 999999999) {
                                sendMessageParams.content.fromTimeNanos = whereClause.fromTimeNanos = parseInt(params.fromTimeNanos);
                            }
                        }

                        if (parseInt(params.toTimeFull) > 0 && params.toTimeFull.toString().length === 19) {
                            sendMessageParams.content.toTime = whereClause.toTime = parseInt(params.toTimeFull.toString()
                                .substring(0, 13));
                            sendMessageParams.content.toTimeNanos = whereClause.toTimeNanos = parseInt(params.toTimeFull.toString()
                                .substring(10, 19));
                        } else {
                            if (parseInt(params.toTime) > 0 && parseInt(params.toTime) < 9999999999999) {
                                sendMessageParams.content.toTime = whereClause.toTime = parseInt(params.toTime);
                            }

                            if (parseInt(params.toTimeNanos) > 0 && parseInt(params.toTimeNanos) < 999999999) {
                                sendMessageParams.content.toTimeNanos = whereClause.toTimeNanos = parseInt(params.toTimeNanos);
                            }
                        }

                        if (typeof params.query != 'undefined') {
                            sendMessageParams.content.query = whereClause.query = params.query;
                        }

                        if (params.allMentioned && typeof params.allMentioned == 'boolean') {
                            sendMessageParams.content.allMentioned = whereClause.allMentioned = params.allMentioned;
                        }

                        if (params.unreadMentioned && typeof params.unreadMentioned == 'boolean') {
                            sendMessageParams.content.unreadMentioned = whereClause.unreadMentioned = params.unreadMentioned;
                        }

                        if (params.messageType && typeof params.messageType.toUpperCase() !== 'undefined' && chatMessageTypes[params.messageType.toUpperCase()] > 0) {
                            sendMessageParams.content.messageType = whereClause.messageType = chatMessageTypes[params.messageType.toUpperCase()];
                        }

                        if (typeof params.metadataCriteria == 'object' && params.metadataCriteria.hasOwnProperty('field')) {
                            sendMessageParams.content.metadataCriteria = whereClause.metadataCriteria = params.metadataCriteria;
                        }

                        /**
                         * Get Thread Messages from cache
                         *
                         * Because we are not applying metadataCriteria search
                         * on cached data, if this attribute has been set, we
                         * should not return any results from cache
                         */

                        // TODO ASC order?!
                        if (functionLevelCache
                            && canUseCache
                            && cacheSecret.length > 0
                            && !whereClause.hasOwnProperty('metadataCriteria')
                            && order.toLowerCase() !== "asc") {
                            if (db) {
                                var table = db.messages,
                                    collection;
                                returnCache = true;

                                if (whereClause.hasOwnProperty('id') && whereClause.id > 0) {
                                    collection = table.where('id')
                                        .equals(parseInt(params.id))
                                        .and(function (message) {
                                            return message.owner === userInfo.id;
                                        })
                                        .reverse();
                                } else {
                                    collection = table.where('[threadId+owner+time]')
                                        .between([parseInt(params.threadId), parseInt(userInfo.id), minIntegerValue],
                                            [parseInt(params.threadId), parseInt(userInfo.id), maxIntegerValue * 1000])
                                        .reverse();
                                }

                                collection.toArray()
                                    .then(function (resultMessages) {
                                        messages = resultMessages.sort(Utility.dynamicSort('time', !(order === 'asc')));

                                        if (whereClause.hasOwnProperty('fromTime')) {
                                            var fromTime = (whereClause.hasOwnProperty('fromTimeNanos'))
                                                ? (Math.floor(whereClause.fromTime / 1000) * 1000000000) + whereClause.fromTimeNanos
                                                : whereClause.fromTime * 1000000;
                                            messages = messages.filter(function (message) {
                                                return message.time >= fromTime;
                                            });
                                        }

                                        if (whereClause.hasOwnProperty('toTime')) {
                                            var toTime = (whereClause.hasOwnProperty('toTimeNanos'))
                                                ? ((Math.floor(whereClause.toTime / 1000)) * 1000000000) + whereClause.toTimeNanos
                                                : (whereClause.toTime) * 1000000;
                                            messages = messages.filter(function (message) {
                                                return message.time <= toTime;
                                            });
                                        }

                                        if (whereClause.hasOwnProperty('query') && typeof whereClause.query == 'string') {
                                            messages = messages.filter(function (message) {
                                                var reg = new RegExp(whereClause.query);
                                                return reg.test(chatDecrypt(message.message, cacheSecret, message.salt));
                                            });
                                        }

                                        /**
                                         * We should check to see if message[offset-1] has
                                         * GAP on cache or not? if yes, we should not return
                                         * any value from cache, because there is a gap between
                                         */
                                        if (offset > 0) {
                                            if (typeof messages[offset - 1] == 'object' && messages[offset - 1].hasGap) {
                                                returnCache = false;
                                            }
                                        }

                                        if (returnCache) {
                                            messages = messages.slice(offset, offset + count);

                                            if (messages.length === 0) {
                                                returnCache = false;
                                            }

                                            cacheFirstMessage = messages[0];
                                            cacheLastMessage = messages[messages.length - 1];

                                            /**
                                             * There should not be any GAPs before
                                             * firstMessage of requested messages in cache
                                             * if there is a gap or more, the cache is not
                                             * valid, therefore we wont return any values
                                             * from cache and wait for server's response
                                             *
                                             * To find out if there is a gap or not, all we
                                             * have to do is to check messageGaps table and
                                             * query it for gaps with time bigger than
                                             * firstMessage's time
                                             */
                                            if (cacheFirstMessage && cacheFirstMessage.time > 0) {
                                                db.messageGaps
                                                    .where('[threadId+owner+time]')
                                                    .between([parseInt(params.threadId), parseInt(userInfo.id), cacheFirstMessage.time],
                                                        [parseInt(params.threadId), parseInt(userInfo.id), maxIntegerValue * 1000], true, true)
                                                    .toArray()
                                                    .then(function (gaps) {
                                                        // TODO fill these gaps in a worker
                                                        if (gaps.length > 0) {
                                                            returnCache = false;
                                                        }
                                                    })
                                                    .catch(function (error) {
                                                        fireEvent('error', {
                                                            code: error.code,
                                                            message: error.message,
                                                            error: error
                                                        });
                                                    });
                                            }

                                            if (returnCache) {
                                                collection.count()
                                                    .then(function (collectionContentCount) {
                                                        var contentCount = 0;
                                                        var cacheData = [];

                                                        for (var i = 0; i < messages.length; i++) {
                                                            /**
                                                             * If any of messages between first and last message of cache response
                                                             * has a GAP before them, we shouldn't return cache's result and
                                                             * wait for server's response to hit in
                                                             */
                                                            if (i !== 0 && i !== messages.length - 1 && messages[i].hasGap) {
                                                                returnCache = false;
                                                                break;
                                                            }

                                                            try {
                                                                var tempMessage = formatDataToMakeMessage(messages[i].threadId, JSON.parse(chatDecrypt(messages[i].data, cacheSecret, messages[i].salt)), true);
                                                                cacheData.push(tempMessage);

                                                                cacheResult[tempMessage.id] = {
                                                                    index: i,
                                                                    messageId: tempMessage.id,
                                                                    threadId: tempMessage.threadId,
                                                                    data: Utility.MD5(JSON.stringify([
                                                                        tempMessage.id,
                                                                        tempMessage.message,
                                                                        tempMessage.metadata,
                                                                        tempMessage.systemMetadata]))
                                                                };
                                                            } catch (error) {
                                                                fireEvent('error', {
                                                                    code: error.code,
                                                                    message: error.message,
                                                                    error: error
                                                                });
                                                            }
                                                        }

                                                        /**
                                                         * If there is a GAP between messages of cache result
                                                         * WE should not return data from cache, cause it is not valid!
                                                         * Therefore we wait for server's response and edit cache afterwards
                                                         */
                                                        if (returnCache) {

                                                            /**
                                                             * Get contentCount of this thread from cache
                                                             */
                                                            db.contentCount
                                                                .where('threadId')
                                                                .equals(parseInt(params.threadId))
                                                                .toArray()
                                                                .then(function (res) {
                                                                    var hasNext = true;
                                                                    if (res.length > 0 && res[0].threadId === parseInt(params.threadId)) {
                                                                        contentCount = res[0].contentCount;
                                                                        hasNext = offset + count < res[0].contentCount && messages.length > 0
                                                                    } else {
                                                                        contentCount = collectionContentCount;
                                                                    }

                                                                    var returnData = {
                                                                        hasError: false,
                                                                        cache: true,
                                                                        errorCode: 0,
                                                                        errorMessage: '',
                                                                        result: {
                                                                            history: cacheData,
                                                                            contentCount: contentCount,
                                                                            hasNext: hasNext,
                                                                            nextOffset: offset * 1 + messages.length
                                                                        }
                                                                    };

                                                                    if (sendingQueue) {
                                                                        returnData.result.sending = sendingQueueMessages;
                                                                    }
                                                                    if (uploadingQueue) {
                                                                        returnData.result.uploading = uploadingQueueMessages;
                                                                    }
                                                                    if (failedQueue) {
                                                                        returnData.result.failed = failedQueueMessages;
                                                                    }

                                                                    cacheReady = true;

                                                                    callback && callback(returnData);
                                                                    callback = undefined;
                                                                })
                                                                .catch(function (error) {
                                                                    fireEvent('error', {
                                                                        code: error.code,
                                                                        message: error.message,
                                                                        error: error
                                                                    });
                                                                });
                                                        }
                                                    })
                                                    .catch(function (error) {
                                                        fireEvent('error', {
                                                            code: error.code,
                                                            message: error.message,
                                                            error: error
                                                        });
                                                    });
                                            }
                                        }
                                    })
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                        /**
                         * Get Thread Messages From Server
                         */
                        return sendMessage(sendMessageParams, {
                            onResult: function (result) {

                                var returnData = {
                                        hasError: result.hasError,
                                        cache: false,
                                        errorMessage: result.errorMessage,
                                        errorCode: result.errorCode
                                    },
                                    resultMessagesId = [];

                                if (!returnData.hasError) {
                                    var messageContent = result.result,
                                        messageLength = messageContent.length;

                                    var history = reformatThreadHistory(params.threadId, messageContent);

                                    if (messageLength > 0) {
                                        /**
                                         * Calculating First and Last Messages of result
                                         */
                                        var lastMessage = history[messageContent.length - 1],
                                            firstMessage = history[0];

                                        /**
                                         * Sending Delivery for Last Message of Thread
                                         */
                                        if (userInfo.id !== firstMessage.participant.id && !firstMessage.delivered) {
                                            putInMessagesDeliveryQueue(params.threadId, firstMessage.id);
                                        }
                                    }

                                    /**
                                     * Add Thread Messages into cache database
                                     * and remove deleted messages from cache database
                                     */
                                    if (canUseCache && cacheSecret.length > 0) {
                                        if (db) {

                                            /**
                                             * Cache Synchronization
                                             *
                                             * If there are some results in cache
                                             * Database, we have to check if they need
                                             * to be deleted or not?
                                             *
                                             * To do so, first of all we should make
                                             * sure that metadataCriteria has not been
                                             * set, cuz we are not applying it on the
                                             * cache results, besides the results from
                                             * cache should not be empty, otherwise
                                             * there is no need to sync cache
                                             */
                                            if (Object.keys(cacheResult).length > 0 && !whereClause.hasOwnProperty('metadataCriteria')) {

                                                /**
                                                 * Check if a condition has been
                                                 * applied on query or not, if there is
                                                 * none, the only limitations on
                                                 * results are count and offset
                                                 *
                                                 * whereClause == []
                                                 */
                                                if (!whereClause || Object.keys(whereClause).length === 0) {

                                                    /**
                                                     * There is no condition applied on
                                                     * query and result is [], so there
                                                     * are no messages in this thread
                                                     * after this offset, and we should
                                                     * delete those messages from cache
                                                     * too
                                                     *
                                                     * result   []
                                                     */
                                                    if (messageLength === 0) {

                                                        /**
                                                         * Order is ASC, so if the server result is empty we
                                                         * should delete everything from cache which has bigger
                                                         * time than first item of cache results for this query
                                                         */
                                                        if (order === 'asc') {
                                                            var finalMessageTime = cacheFirstMessage.time;

                                                            db.messages.where('[threadId+owner+time]')
                                                                .between([parseInt(params.threadId), parseInt(userInfo.id), finalMessageTime],
                                                                    [parseInt(params.threadId), parseInt(userInfo.id), maxIntegerValue * 1000], true, false)
                                                                .delete()
                                                                .catch(function (error) {
                                                                    fireEvent('error', {
                                                                        code: error.code,
                                                                        message: error.message,
                                                                        error: error
                                                                    });
                                                                });
                                                        }

                                                        /**
                                                         * Order is DESC, so if the
                                                         * server result is empty we
                                                         * should delete everything
                                                         * from cache which has smaller
                                                         * time than first item of
                                                         * cache results for this query
                                                         */
                                                        else {
                                                            var finalMessageTime = cacheFirstMessage.time;

                                                            db.messages.where('[threadId+owner+time]')
                                                                .between([parseInt(params.threadId), parseInt(userInfo.id), 0],
                                                                    [parseInt(params.threadId), parseInt(userInfo.id), finalMessageTime], true, true)
                                                                .delete()
                                                                .catch(function (error) {
                                                                    fireEvent('error', {
                                                                        code: error.code,
                                                                        message: error.message,
                                                                        error: error
                                                                    });
                                                                });
                                                        }
                                                    }

                                                    /**
                                                     * Result is not Empty or doesn't
                                                     * have just one single record, so
                                                     * we should remove everything
                                                     * which are between firstMessage
                                                     * and lastMessage of this result
                                                     * from cache database and insert
                                                     * the new result into cache, so
                                                     * the deleted ones would be
                                                     * deleted
                                                     *
                                                     * result   [..., n-1, n, n+1, ...]
                                                     */
                                                    else {

                                                        /**
                                                         * We should check for last message's previouseId if it
                                                         * is undefined, so it is the first message of thread and
                                                         * we should delete everything before it from cache
                                                         */
                                                        if (typeof firstMessage.previousId === 'undefined' || typeof lastMessage.previousId === 'undefined') {
                                                            var finalMessageTime = (typeof lastMessage.previousId === 'undefined')
                                                                ? lastMessage.time
                                                                : firstMessage.time;

                                                            db.messages.where('[threadId+owner+time]')
                                                                .between([parseInt(params.threadId), parseInt(userInfo.id), 0],
                                                                    [parseInt(params.threadId), parseInt(userInfo.id), finalMessageTime], true, false)
                                                                .delete()
                                                                .catch(function (error) {
                                                                    fireEvent('error', {
                                                                        code: error.code,
                                                                        message: error.message,
                                                                        error: error
                                                                    });
                                                                });
                                                        }

                                                        /**
                                                         * Offset has been set as 0 so this result is either the
                                                         * very beginning part of thread or the very last
                                                         * Depending on the sort order
                                                         *
                                                         * offset == 0
                                                         */
                                                        if (offset === 0) {

                                                            /**
                                                             * Results are sorted ASC, and the offset is 0 so
                                                             * the first Message of this result is first
                                                             * Message of thread, everything in cache
                                                             * database which has smaller time than this
                                                             * one should be removed
                                                             *
                                                             * order    ASC
                                                             * result   [0, 1, 2, ...]
                                                             */
                                                            if (order === 'asc') {
                                                                var finalMessageTime = firstMessage.time;

                                                                db.messages.where('[threadId+owner+time]')
                                                                    .between([parseInt(params.threadId), parseInt(userInfo.id), 0],
                                                                        [parseInt(params.threadId), parseInt(userInfo.id), finalMessageTime], true, false)
                                                                    .delete()
                                                                    .catch(function (error) {
                                                                        fireEvent('error', {
                                                                            code: error.code,
                                                                            message: error.message,
                                                                            error: error
                                                                        });
                                                                    });
                                                            }

                                                            /**
                                                             * Results are sorted DESC and the offset is 0 so
                                                             * the last Message of this result is the last
                                                             * Message of the thread, everything in cache
                                                             * database which has bigger time than this
                                                             * one should be removed from cache
                                                             *
                                                             * order    DESC
                                                             * result   [..., n-2, n-1, n]
                                                             */
                                                            else {
                                                                var finalMessageTime = firstMessage.time;

                                                                db.messages.where('[threadId+owner+time]')
                                                                    .between([parseInt(params.threadId), parseInt(userInfo.id), finalMessageTime],
                                                                        [parseInt(params.threadId), parseInt(userInfo.id), maxIntegerValue * 1000], false, true)
                                                                    .delete()
                                                                    .catch(function (error) {
                                                                        fireEvent('error', {
                                                                            code: error.code,
                                                                            message: error.message,
                                                                            error: error
                                                                        });
                                                                    });
                                                            }
                                                        }

                                                        /**
                                                         * Server result is not Empty, so we should remove
                                                         * everything which are between firstMessage and lastMessage
                                                         * of this result from cache database and insert the new
                                                         * result into cache, so the deleted ones would be deleted
                                                         *
                                                         * result   [..., n-1, n, n+1, ...]
                                                         */
                                                        var boundryStartMessageTime = (firstMessage.time < lastMessage.time)
                                                            ? firstMessage.time
                                                            : lastMessage.time,
                                                            boundryEndMessageTime = (firstMessage.time > lastMessage.time)
                                                                ? firstMessage.time
                                                                : lastMessage.time;

                                                        db.messages.where('[threadId+owner+time]')
                                                            .between([parseInt(params.threadId), parseInt(userInfo.id), boundryStartMessageTime],
                                                                [parseInt(params.threadId), parseInt(userInfo.id), boundryEndMessageTime], true, true)
                                                            .delete()
                                                            .catch(function (error) {
                                                                fireEvent('error', {
                                                                    code: error.code,
                                                                    message: error.message,
                                                                    error: error
                                                                });
                                                            });
                                                    }
                                                }

                                                /**
                                                 * whereClasue is not empty and we
                                                 * should check for every single one of
                                                 * the conditions to update the cache
                                                 * properly
                                                 *
                                                 * whereClause != []
                                                 */
                                                else {

                                                    /**
                                                     * When user ordered a message with
                                                     * exact ID and server returns []
                                                     * but there is something in cache
                                                     * database, we should delete that
                                                     * row from cache, because it has
                                                     * been deleted
                                                     */
                                                    if (whereClause.hasOwnProperty('id') && whereClause.id > 0) {
                                                        db.messages.where('id')
                                                            .equals(parseInt(whereClause.id))
                                                            .and(function (message) {
                                                                return message.owner === userInfo.id;
                                                            })
                                                            .delete()
                                                            .catch(function (error) {
                                                                fireEvent('error', {
                                                                    code: error.code,
                                                                    message: error.message,
                                                                    error: error
                                                                });
                                                            });
                                                    }

                                                    /**
                                                     * When user sets a query to search
                                                     * on messages we should delete all
                                                     * the results came from cache and
                                                     * insert new results instead,
                                                     * because those messages would be
                                                     * either removed or updated
                                                     */
                                                    if (whereClause.hasOwnProperty('query') && typeof whereClause.query == 'string') {
                                                        db.messages.where('[threadId+owner+time]')
                                                            .between([parseInt(params.threadId), parseInt(userInfo.id), minIntegerValue],
                                                                [parseInt(params.threadId), parseInt(userInfo.id), maxIntegerValue * 1000])
                                                            .and(function (message) {
                                                                var reg = new RegExp(whereClause.query);
                                                                return reg.test(chatDecrypt(message.message, cacheSecret, message.salt));
                                                            })
                                                            .delete()
                                                            .catch(function (error) {
                                                                fireEvent('error', {
                                                                    code: error.code,
                                                                    message: error.message,
                                                                    error: error
                                                                });
                                                            });
                                                    }

                                                    /**
                                                     * Users sets fromTime or toTime or
                                                     * both of them
                                                     */
                                                    if (whereClause.hasOwnProperty('fromTime') || whereClause.hasOwnProperty('toTime')) {

                                                        /**
                                                         * Server response is Empty []
                                                         */
                                                        if (messageLength === 0) {

                                                            /**
                                                             * User set both fromTime and toTime, so we have a
                                                             * boundary restriction in this case. if server
                                                             * result is empty, we should delete all messages from cache
                                                             * which are between fromTime and toTime. if
                                                             * there are any messages on server in this
                                                             * boundary, we should delete all messages
                                                             * which are between time of first and last
                                                             * message of the server result, from cache and
                                                             * insert new result into cache.
                                                             */
                                                            if (whereClause.hasOwnProperty('fromTime') && whereClause.hasOwnProperty('toTime')) {

                                                                /**
                                                                 * Server response is Empty []
                                                                 */
                                                                var fromTime = (whereClause.hasOwnProperty('fromTimeNanos'))
                                                                    ? ((whereClause.fromTime / 1000) * 1000000000) + whereClause.fromTimeNanos
                                                                    : whereClause.fromTime * 1000000,
                                                                    toTime = (whereClause.hasOwnProperty('toTimeNanos'))
                                                                        ? (((whereClause.toTime / 1000) + 1) * 1000000000) + whereClause.toTimeNanos
                                                                        : (whereClause.toTime + 1) * 1000000;

                                                                db.messages.where('[threadId+owner+time]')
                                                                    .between([parseInt(params.threadId), parseInt(userInfo.id), fromTime],
                                                                        [parseInt(params.threadId), parseInt(userInfo.id), toTime], true, true)
                                                                    .delete()
                                                                    .catch(function (error) {
                                                                        fireEvent('error', {
                                                                            code: error.code,
                                                                            message: error.message,
                                                                            error: error
                                                                        });
                                                                    });
                                                            }

                                                            /**
                                                             * User only set fromTime
                                                             */
                                                            else if (whereClause.hasOwnProperty('fromTime')) {

                                                                /**
                                                                 * Server response is Empty []
                                                                 */
                                                                var fromTime = (whereClause.hasOwnProperty('fromTimeNanos'))
                                                                    ? ((whereClause.fromTime / 1000) * 1000000000) + whereClause.fromTimeNanos
                                                                    : whereClause.fromTime * 1000000;

                                                                db.messages.where('[threadId+owner+time]')
                                                                    .between([parseInt(params.threadId), parseInt(userInfo.id), fromTime],
                                                                        [parseInt(params.threadId), parseInt(userInfo.id), maxIntegerValue * 1000], true, false)
                                                                    .delete()
                                                                    .catch(function (error) {
                                                                        fireEvent('error', {
                                                                            code: error.code,
                                                                            message: error.message,
                                                                            error: error
                                                                        });
                                                                    });
                                                            }

                                                            /**
                                                             * User only set toTime
                                                             */
                                                            else {
                                                                /**
                                                                 * Server response is Empty []
                                                                 */
                                                                var toTime = (whereClause.hasOwnProperty('toTimeNanos'))
                                                                    ? (((whereClause.toTime / 1000) + 1) * 1000000000) + whereClause.toTimeNanos
                                                                    : (whereClause.toTime + 1) * 1000000;

                                                                db.messages.where('[threadId+owner+time]')
                                                                    .between([parseInt(params.threadId), parseInt(userInfo.id), minIntegerValue],
                                                                        [parseInt(params.threadId), parseInt(userInfo.id), toTime], true, true)
                                                                    .delete()
                                                                    .catch(function (error) {
                                                                        fireEvent('error', {
                                                                            code: error.code,
                                                                            message: error.message,
                                                                            error: error
                                                                        });
                                                                    });
                                                            }
                                                        }

                                                        /**
                                                         * Server response is not Empty
                                                         * [..., n-1, n, n+1, ...]
                                                         */
                                                        else {

                                                            /**
                                                             * Server response is not Empty
                                                             * [..., n-1, n, n+1, ...]
                                                             */
                                                            var boundryStartMessageTime = (firstMessage.time < lastMessage.time)
                                                                ? firstMessage.time
                                                                : lastMessage.time,
                                                                boundryEndMessageTime = (firstMessage.time > lastMessage.time)
                                                                    ? firstMessage.time
                                                                    : lastMessage.time;

                                                            db.messages.where('[threadId+owner+time]')
                                                                .between([parseInt(params.threadId), parseInt(userInfo.id), boundryStartMessageTime],
                                                                    [parseInt(params.threadId), parseInt(userInfo.id), boundryEndMessageTime], true, true)
                                                                .delete()
                                                                .catch(function (error) {
                                                                    fireEvent('error', {
                                                                        code: error.code,
                                                                        message: error.message,
                                                                        error: error
                                                                    });
                                                                });
                                                        }
                                                    }
                                                }
                                            }

                                            /**
                                             * Insert new messages into cache database
                                             * after deleting old messages from cache
                                             */
                                            var cacheData = [];

                                            for (var i = 0; i < history.length; i++) {
                                                serverResult[history[i].id] = {
                                                    index: i,
                                                    data: Utility.MD5(JSON.stringify([
                                                        history[i].id,
                                                        history[i].message,
                                                        history[i].metadata,
                                                        history[i].systemMetadata]))
                                                };
                                                try {
                                                    var tempData = {},
                                                        salt = Utility.generateUUID();
                                                    tempData.id = parseInt(history[i].id);
                                                    tempData.owner = parseInt(userInfo.id);
                                                    tempData.threadId = parseInt(history[i].threadId);
                                                    tempData.time = history[i].time;
                                                    tempData.message = Utility.crypt(history[i].message, cacheSecret, salt);
                                                    tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(history[i])), cacheSecret, salt);
                                                    tempData.salt = salt;
                                                    tempData.sendStatus = 'sent';
                                                    tempData.hasGap = false;

                                                    cacheData.push(tempData);
                                                    resultMessagesId.push(history[i].id);
                                                } catch (error) {
                                                    fireEvent('error', {
                                                        code: error.code,
                                                        message: error.message,
                                                        error: error
                                                    });
                                                }
                                            }

                                            db.messages.bulkPut(cacheData)
                                                .then(function () {
                                                    if (typeof lastMessage == 'object' &&
                                                        lastMessage != null &&
                                                        lastMessage.id > 0 &&
                                                        lastMessage.previousId > 0) {
                                                        /**
                                                         * Check to see if there is a Gap in cache before
                                                         * lastMessage or not?
                                                         * To do this, we should check existence of message
                                                         * with the ID of lastMessage's previousId field
                                                         */
                                                        db.messages
                                                            .where('[owner+id]')
                                                            .between([userInfo.id, lastMessage.previousId], [userInfo.id, lastMessage.previousId], true, true)
                                                            .toArray()
                                                            .then(function (messages) {
                                                                if (messages.length === 0) {
                                                                    /**
                                                                     * Previous Message of last message is not in cache database
                                                                     * so there is a GAP in cache database for this thread before
                                                                     * the last message.
                                                                     * We should insert this GAP in messageGaps database
                                                                     */
                                                                    db.messageGaps
                                                                        .put({
                                                                            id: parseInt(lastMessage.id),
                                                                            owner: parseInt(userInfo.id),
                                                                            waitsFor: parseInt(lastMessage.previousId),
                                                                            threadId: parseInt(lastMessage.threadId),
                                                                            time: lastMessage.time
                                                                        })
                                                                        .then(function () {
                                                                            db.messages
                                                                                .update([userInfo.id, lastMessage.id], {hasGap: true})
                                                                                .catch(function (error) {
                                                                                    fireEvent('error', {
                                                                                        code: error.code,
                                                                                        message: error.message,
                                                                                        error: error
                                                                                    });
                                                                                });
                                                                        })
                                                                        .catch(function (error) {
                                                                            fireEvent('error', {
                                                                                code: error.code,
                                                                                message: error.message,
                                                                                error: error
                                                                            });
                                                                        });
                                                                }
                                                            })
                                                            .catch(function (error) {
                                                                fireEvent('error', {
                                                                    code: error.code,
                                                                    message: error.message,
                                                                    error: error
                                                                });
                                                            });
                                                    }

                                                    /**
                                                     * Some new messages have been added into cache,
                                                     * We should check to see if any GAPs have been
                                                     * filled with these messages or not?
                                                     */

                                                    db.messageGaps
                                                        .where('waitsFor')
                                                        .anyOf(resultMessagesId)
                                                        .and(function (messages) {
                                                            return messages.owner === userInfo.id;
                                                        })
                                                        .toArray()
                                                        .then(function (needsToBeDeleted) {
                                                            /**
                                                             * These messages have to be deleted from messageGaps table
                                                             */
                                                            var messagesToBeDeleted = needsToBeDeleted.map(function (msg) {
                                                                /**
                                                                 * We have to update messages table and
                                                                 * set hasGap for those messages as false
                                                                 */
                                                                db.messages
                                                                    .update([userInfo.id, msg.id], {hasGap: false})
                                                                    .catch(function (error) {
                                                                        fireEvent('error', {
                                                                            code: error.code,
                                                                            message: error.message,
                                                                            error: error
                                                                        });
                                                                    });

                                                                return [userInfo.id, msg.id];
                                                            });

                                                            db.messageGaps.bulkDelete(messagesToBeDeleted);
                                                        })
                                                        .catch(function (error) {
                                                            fireEvent('error', {
                                                                code: error.code,
                                                                message: error.message,
                                                                error: error
                                                            });
                                                        });
                                                })
                                                .catch(function (error) {
                                                    fireEvent('error', {
                                                        code: error.code,
                                                        message: error.message,
                                                        error: error
                                                    });
                                                });

                                            /**
                                             * Update contentCount of this thread in cache
                                             * contentCount of thread would be count of all
                                             * thread messages if and only if there are no
                                             * other conditions applied on getHistory that
                                             * count and offset
                                             */
                                            if ((Object.keys(whereClause).length === 0)) {
                                                db.contentCount
                                                    .put({
                                                        threadId: parseInt(params.threadId),
                                                        contentCount: result.contentCount
                                                    })
                                                    .catch(function (error) {
                                                        fireEvent('error', {
                                                            code: error.code,
                                                            message: error.message,
                                                            error: error
                                                        });
                                                    });
                                            }
                                        } else {
                                            fireEvent('error', {
                                                code: 6601,
                                                message: CHAT_ERRORS[6601],
                                                error: null
                                            });
                                        }
                                    }

                                    returnData.result = {
                                        history: history,
                                        contentCount: result.contentCount,
                                        hasNext: (sendMessageParams.content.offset + sendMessageParams.content.count < result.contentCount &&
                                            messageLength > 0),
                                        nextOffset: sendMessageParams.content.offset * 1 + messageLength * 1
                                    };

                                    if (sendingQueue) {
                                        returnData.result.sending = sendingQueueMessages;
                                    }
                                    if (uploadingQueue) {
                                        returnData.result.uploading = uploadingQueueMessages;
                                    }
                                    if (failedQueue) {
                                        returnData.result.failed = failedQueueMessages;
                                    }


                                    /**
                                     * Check Differences between Cache and Server response
                                     */
                                    if (returnCache && cacheReady) {
                                        /**
                                         * If there are some messages in cache but they
                                         * are not in server's response, we can assume
                                         * that they have been removed from server, so
                                         * we should call MESSAGE_DELETE event for them
                                         */

                                        var batchDeleteMessage = [],
                                            batchEditMessage = [],
                                            batchNewMessage = [];

                                        for (var key in cacheResult) {
                                            if (!serverResult.hasOwnProperty(key)) {
                                                batchDeleteMessage.push({
                                                    id: cacheResult[key].messageId,
                                                    pinned: cacheResult[key].pinned,
                                                    threadId: cacheResult[key].threadId
                                                });

                                                // fireEvent('messageEvents', {
                                                //     type: 'MESSAGE_DELETE',
                                                //     result: {
                                                //         message: {
                                                //             id: cacheResult[key].messageId,
                                                //             pinned: cacheResult[key].pinned,
                                                //             threadId: cacheResult[key].threadId
                                                //         }
                                                //     }
                                                // });
                                            }
                                        }

                                        if (batchDeleteMessage.length) {
                                            fireEvent('messageEvents', {
                                                type: 'MESSAGE_DELETE_BATCH',
                                                cache: true,
                                                result: batchDeleteMessage
                                            });
                                        }

                                        for (var key in serverResult) {
                                            if (cacheResult.hasOwnProperty(key)) {
                                                /**
                                                 * Check digest of cache and server response, if
                                                 * they are not the same, we should emit
                                                 */
                                                if (cacheResult[key].data !== serverResult[key].data) {
                                                    /**
                                                     * This message is already on cache, but it's
                                                     * content has been changed, so we emit a
                                                     * message edit event to inform client
                                                     */

                                                    batchEditMessage.push(history[serverResult[key].index]);

                                                    // fireEvent('messageEvents', {
                                                    //     type: 'MESSAGE_EDIT',
                                                    //     result: {
                                                    //         message: history[serverResult[key].index]
                                                    //     }
                                                    // });
                                                }
                                            } else {
                                                /**
                                                 * This Message has not found on cache but it has
                                                 * came from server, so we emit it as a new message
                                                 */

                                                batchNewMessage.push(history[serverResult[key].index]);

                                                // fireEvent('messageEvents', {
                                                //     type: 'MESSAGE_NEW',
                                                //     cache: true,
                                                //     result: {
                                                //         message: history[serverResult[key].index]
                                                //     }
                                                // });
                                            }
                                        }

                                        if (batchEditMessage.length) {
                                            fireEvent('messageEvents', {
                                                type: 'MESSAGE_EDIT_BATCH',
                                                cache: true,
                                                result: batchEditMessage
                                            });
                                        }

                                        if (batchNewMessage.length) {
                                            fireEvent('messageEvents', {
                                                type: 'MESSAGE_NEW_BATCH',
                                                cache: true,
                                                result: batchNewMessage
                                            });
                                        }
                                    } else {
                                        callback && callback(returnData);
                                        callback = undefined;
                                    }
                                }
                            }
                        });
                    });
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Thread ID is required for Getting history!'
                    });
                }
            },

            /**
             * Update Thread Info
             *
             * This functions updates metadata of thread
             *
             * @access private
             *
             * @param {int}       threadId      Id of thread
             * @param {string}    image         URL og thread image to be set
             * @param {string}    description   Description for thread
             * @param {string}    title         New Title for thread
             * @param {object}    metadata      New Metadata to be set on thread
             * @param {function}  callback      The callback function to call after
             *
             * @return {object} Instant sendMessage result
             */
            updateThreadInfo = function (params, callback) {
                var updateThreadInfoData = {
                        chatMessageVOType: chatMessageVOTypes.UPDATE_THREAD_INFO,
                        typeCode: params.typeCode,
                        content: {},
                        pushMsgType: 3,
                        token: token
                    },
                    threadInfoContent = {},
                    fileUploadParams = {},
                    metadata = {file: {}},
                    threadId,
                    fileUniqueId = Utility.generateUUID();

                if (params) {
                    if (!params.userGroupHash || params.userGroupHash.length === 0 || typeof (params.userGroupHash) !== 'string') {
                        fireEvent('error', {
                            code: 6304,
                            message: CHAT_ERRORS[6304]
                        });
                        return;
                    } else {
                        fileUploadParams.userGroupHash = params.userGroupHash;
                    }

                    if (parseInt(params.threadId) > 0) {
                        threadId = parseInt(params.threadId);
                        updateThreadInfoData.subjectId = threadId;
                    } else {
                        fireEvent('error', {
                            code: 999,
                            message: 'Thread ID is required for Updating thread info!'
                        });
                    }

                    if (typeof params.description == 'string') {
                        threadInfoContent.description = params.description;
                    }

                    if (typeof params.title == 'string') {
                        threadInfoContent.name = params.title;
                    }

                    if (typeof params.metadata == 'object') {
                        threadInfoContent.metadata = JSON.parse(JSON.stringify(params.metadata));
                    } else if (typeof params.metadata == 'string') {
                        try {
                            threadInfoContent.metadata = JSON.parse(params.metadata);
                        } catch (e) {
                            threadInfoContent.metadata = {};
                        }
                    } else {
                        threadInfoContent.metadata = {};
                    }

                    updateThreadInfoData.content = threadInfoContent;

                    if (typeof params.image == 'object' && params.image.size > 0) {
                        return chatUploadHandler({
                            threadId: threadId,
                            file: params.image,
                            fileUniqueId: fileUniqueId
                        }, function (uploadHandlerResult, uploadHandlerMetadata, fileType, fileExtension) {
                            fileUploadParams = Object.assign(fileUploadParams, uploadHandlerResult);

                            threadInfoContent.metadata = JSON.stringify(Object.assign(threadInfoContent.metadata, uploadHandlerMetadata));
                            putInChatUploadQueue({
                                message: {
                                    chatMessageVOType: chatMessageVOTypes.UPDATE_THREAD_INFO,
                                    typeCode: params.typeCode,
                                    subjectId: threadId,
                                    content: threadInfoContent,
                                    metadata: threadInfoContent.metadata,
                                    uniqueId: fileUniqueId,
                                    pushMsgType: 3,
                                    token: token
                                },
                                callbacks: callback
                            }, function () {
                                if (imageMimeTypes.indexOf(fileType) >= 0 || imageExtentions.indexOf(fileExtension) >= 0) {
                                    uploadImageToPodspaceUserGroup(fileUploadParams, function (result) {
                                        if (!result.hasError) {
                                            metadata['name'] = result.result.name;
                                            metadata['fileHash'] = result.result.hashCode;
                                            metadata['file']['name'] = result.result.name;
                                            metadata['file']['fileHash'] = result.result.hashCode;
                                            metadata['file']['hashCode'] = result.result.hashCode;
                                            metadata['file']['parentHash'] = result.result.parentHash;
                                            metadata['file']['size'] = result.result.size;
                                            metadata['file']['actualHeight'] = result.result.actualHeight;
                                            metadata['file']['actualWidth'] = result.result.actualWidth;
                                            metadata['file']['link'] = `https://podspace.pod.ir/nzh/drive/downloadImage?hash=${result.result.hashCode}`;
                                            transferFromUploadQToSendQ(parseInt(params.threadId), fileUniqueId, JSON.stringify(metadata), function () {
                                                chatSendQueueHandler();
                                            });
                                        } else {
                                            deleteFromChatUploadQueue({message: {uniqueId: fileUniqueId}});
                                        }
                                    });
                                } else {
                                    fireEvent('error', {
                                        code: 999,
                                        message: 'Thread picture can be a image type only!'
                                    });
                                }
                            });
                        });
                    } else if (typeof params.image == 'string' && params.image.length > 5) {
                        threadInfoContent.metadata = JSON.stringify(Object.assign(threadInfoContent.metadata, {fileHash: params.image}));

                        getImageDownloadLinkFromPodspace({
                            hashCode: params.image
                        }, function (result) {
                            if (!result.hasError) {
                                threadInfoContent.image = result.downloadUrl;
                            }
                        });

                        return sendMessage({
                            chatMessageVOType: chatMessageVOTypes.UPDATE_THREAD_INFO,
                            typeCode: params.typeCode,
                            subjectId: threadId,
                            content: threadInfoContent,
                            metadata: threadInfoContent.metadata,
                            uniqueId: fileUniqueId,
                            pushMsgType: 3,
                            token: token
                        }, {
                            onResult: function (result) {
                                callback && callback(result);
                            }
                        });
                    } else {
                        if (Object.keys(threadInfoContent.metadata).length === 0) {
                            delete threadInfoContent.metadata;
                        }

                        return sendMessage({
                            chatMessageVOType: chatMessageVOTypes.UPDATE_THREAD_INFO,
                            typeCode: params.typeCode,
                            subjectId: threadId,
                            content: threadInfoContent,
                            metadata: threadInfoContent.metadata,
                            uniqueId: fileUniqueId,
                            pushMsgType: 3,
                            token: token
                        }, {
                            onResult: function (result) {
                                callback && callback(result);
                            }
                        });
                    }
                }
            },

            /**
             * Update Chat Profile
             *
             * This functions updates metadata of thread
             *
             * @access private
             *
             * @param {int}       threadId      Id of thread
             * @param {string}    image         URL og thread image to be set
             * @param {string}    description   Description for thread
             * @param {string}    title         New Title for thread
             * @param {object}    metadata      New Metadata to be set on thread
             * @param {function}  callback      The callback function to call after
             *
             * @return {object} Instant sendMessage result
             */
            updateChatProfile = function (params, callback) {
                var updateChatProfileData = {
                    chatMessageVOType: chatMessageVOTypes.UPDATE_CHAT_PROFILE,
                    content: {},
                    pushMsgType: 3,
                    token: token
                };
                if (params) {
                    if (typeof params.bio == 'string') {
                        updateChatProfileData.content.bio = params.bio;
                    }
                    if (typeof params.metadata == 'object') {
                        updateChatProfileData.content.metadata = JSON.stringify(params.metadata);
                    } else if (typeof params.metadata == 'string') {
                        updateChatProfileData.content.metadata = params.metadata;
                    }
                }
                return sendMessage(updateChatProfileData, {
                    onResult: function (result) {
                        callback && callback(result);
                    }
                });
            },

            /**
             * Get Participant Roles
             *
             * This functions retrieves roles of an user if they are
             * part of the thread
             *
             * @access private
             *
             * @param {int}       threadId      Id of thread
             * @param {function}  callback      The callback function to call after
             *
             * @return {object} Instant sendMessage result
             */
            getCurrentUserRoles = function (params, callback) {
                var updateChatProfileData = {
                    chatMessageVOType: chatMessageVOTypes.GET_PARTICIPANT_ROLES,
                    pushMsgType: 3,
                    subjectId: params.threadId,
                    token: token
                };
                return sendMessage(updateChatProfileData, {
                    onResult: function (result) {
                        callback && callback(result);
                    }
                });
            },

            /**
             * Get Thread Participants
             *
             * Gets participants list of given thread
             *
             * @access pubic
             *
             * @param {int}     threadId        Id of thread which you want to get participants of
             * @param {int}     count           Count of objects to get
             * @param {int}     offset          Offset of select Query
             * @param {string}  name            Search in Participants list (LIKE in name, contactName, email)
             *
             * @return {object} Instant Response
             */
            getThreadParticipants = function (params, callback) {
                var sendMessageParams = {
                        chatMessageVOType: chatMessageVOTypes.THREAD_PARTICIPANTS,
                        typeCode: params.typeCode,
                        content: {},
                        subjectId: params.threadId
                    },
                    whereClause = {},
                    returnCache = false;

                var offset = (parseInt(params.offset) > 0)
                    ? parseInt(params.offset)
                    : 0,
                    count = (parseInt(params.count) > 0)
                        ? parseInt(params.count)
                        : config.getHistoryCount;

                sendMessageParams.content.count = count;
                sendMessageParams.content.offset = offset;

                if (typeof params.name === 'string') {
                    sendMessageParams.content.name = whereClause.name = params.name;
                }

                if (typeof params.admin === 'boolean') {
                    sendMessageParams.content.admin = params.admin;
                }

                var functionLevelCache = (typeof params.cache == 'boolean') ? params.cache : true;

                /**
                 * Retrieve thread participants from cache
                 */
                if (functionLevelCache && canUseCache && cacheSecret.length > 0) {
                    if (db) {

                        db.participants.where('expireTime')
                            .below(new Date().getTime())
                            .delete()
                            .then(function () {

                                var thenAble;

                                if (Object.keys(whereClause).length === 0) {
                                    thenAble = db.participants.where('threadId')
                                        .equals(parseInt(params.threadId))
                                        .and(function (participant) {
                                            return participant.owner === userInfo.id;
                                        });
                                } else {
                                    if (whereClause.hasOwnProperty('name')) {
                                        thenAble = db.participants.where('threadId')
                                            .equals(parseInt(params.threadId))
                                            .and(function (participant) {
                                                return participant.owner === userInfo.id;
                                            })
                                            .filter(function (contact) {
                                                var reg = new RegExp(whereClause.name);
                                                return reg.test(chatDecrypt(contact.contactName, cacheSecret, contact.salt) + ' '
                                                    + chatDecrypt(contact.name, cacheSecret, contact.salt) + ' '
                                                    + chatDecrypt(contact.email, cacheSecret, contact.salt));
                                            });
                                    }
                                }

                                thenAble.offset(offset)
                                    .limit(count)
                                    .reverse()
                                    .toArray()
                                    .then(function (participants) {
                                        db.participants.where('threadId')
                                            .equals(parseInt(params.threadId))
                                            .and(function (participant) {
                                                return participant.owner === userInfo.id;
                                            })
                                            .count()
                                            .then(function (participantsCount) {

                                                var cacheData = [];

                                                for (var i = 0; i < participants.length; i++) {
                                                    try {
                                                        cacheData.push(formatDataToMakeParticipant(
                                                            JSON.parse(chatDecrypt(participants[i].data, cacheSecret, participants[i].salt)), participants[i].threadId));
                                                    } catch (error) {
                                                        fireEvent('error', {
                                                            code: error.code,
                                                            message: error.message,
                                                            error: error
                                                        });
                                                    }
                                                }

                                                var returnData = {
                                                    hasError: false,
                                                    cache: true,
                                                    errorCode: 0,
                                                    errorMessage: '',
                                                    result: {
                                                        participants: cacheData,
                                                        contentCount: participantsCount,
                                                        hasNext: !(participants.length < count),
                                                        nextOffset: offset * 1 + participants.length
                                                    }
                                                };

                                                if (cacheData.length > 0) {
                                                    callback && callback(returnData);
                                                    callback = undefined;
                                                    returnCache = true;
                                                }
                                            });
                                    })
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });
                            })
                            .catch(function (error) {
                                fireEvent('error', {
                                    code: error.code,
                                    message: error.message,
                                    error: error
                                });
                            });
                    } else {
                        fireEvent('error', {
                            code: 6601,
                            message: CHAT_ERRORS[6601],
                            error: null
                        });
                    }
                }

                return sendMessage(sendMessageParams, {
                    onResult: function (result) {
                        var returnData = {
                            hasError: result.hasError,
                            cache: false,
                            errorMessage: result.errorMessage,
                            errorCode: result.errorCode
                        };

                        if (!returnData.hasError) {
                            var messageContent = result.result,
                                messageLength = messageContent.length,
                                resultData = {
                                    participants: reformatThreadParticipants(messageContent, params.threadId),
                                    contentCount: result.contentCount,
                                    hasNext: (sendMessageParams.content.offset + sendMessageParams.content.count < result.contentCount && messageLength > 0),
                                    nextOffset: sendMessageParams.content.offset * 1 + messageLength * 1
                                };

                            returnData.result = resultData;

                            /**
                             * Add thread participants into cache database #cache
                             */
                            if (canUseCache && cacheSecret.length > 0) {
                                if (db) {

                                    var cacheData = [];

                                    for (var i = 0; i < resultData.participants.length; i++) {
                                        try {
                                            var tempData = {},
                                                salt = Utility.generateUUID();

                                            tempData.id = parseInt(resultData.participants[i].id);
                                            tempData.owner = parseInt(userInfo.id);
                                            tempData.threadId = parseInt(resultData.participants[i].threadId);
                                            tempData.notSeenDuration = resultData.participants[i].notSeenDuration;
                                            tempData.admin = resultData.participants[i].admin;
                                            tempData.auditor = resultData.participants[i].auditor;
                                            tempData.name = Utility.crypt(resultData.participants[i].name, cacheSecret, salt);
                                            tempData.contactName = Utility.crypt(resultData.participants[i].contactName, cacheSecret, salt);
                                            tempData.email = Utility.crypt(resultData.participants[i].email, cacheSecret, salt);
                                            tempData.expireTime = new Date().getTime() + cacheExpireTime;
                                            tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(resultData.participants[i])), cacheSecret, salt);
                                            tempData.salt = salt;

                                            cacheData.push(tempData);
                                        } catch (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        }
                                    }

                                    db.participants.bulkPut(cacheData)
                                        .catch(function (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        });
                                } else {
                                    fireEvent('error', {
                                        code: 6601,
                                        message: CHAT_ERRORS[6601],
                                        error: null
                                    });
                                }
                            }
                        }

                        callback && callback(returnData);
                        /**
                         * Delete callback so if server pushes response before
                         * cache, cache won't send data again
                         */
                        callback = undefined;

                        if (!returnData.hasError && returnCache) {
                            fireEvent('threadEvents', {
                                type: 'THREAD_PARTICIPANTS_LIST_CHANGE',
                                threadId: params.threadId,
                                result: returnData.result
                            });
                        }
                    }
                });
            },

            /**
             * Deliver
             *
             * This functions sends delivery messages for a message
             *
             * @access private
             *
             * @param {int}   messageId  Id of Message
             *
             * @return {object} Instant sendMessage result
             */
            deliver = function (params) {
                return sendMessage({
                    chatMessageVOType: chatMessageVOTypes.DELIVERY,
                    typeCode: params.typeCode,
                    content: params.messageId,
                    pushMsgType: 3
                });
            },

            /**
             * Seen
             *
             * This functions sends seen acknowledge for a message
             *
             * @access private
             *
             * @param {int}   messageId  Id of Message
             *
             * @return {object} Instant sendMessage result
             */
            seen = function (params) {
                return sendMessage({
                    chatMessageVOType: chatMessageVOTypes.SEEN,
                    typeCode: params.typeCode,
                    content: params.messageId,
                    pushMsgType: 3
                });
            },

            /**
             * Get Image.
             *
             * This functions gets an uploaded image from File Server.
             *
             * @since 3.9.9
             * @access private
             *
             * @param {int}    imageId         ID of image
             * @param {int}     width           Required width to get
             * @param {int}     height          Required height to get
             * @param {boolean} actual          Required height to get
             * @param {boolean} downloadable    TRUE to be downloadable / FALSE to not
             * @param {string}  hashCode        HashCode of uploaded file
             *
             * @return {object} Image Object
             */
            getImage = function (params, callback) {
                var getImageData = {};

                if (params) {
                    if (parseInt(params.imageId) > 0) {
                        getImageData.imageId = params.imageId;
                    }

                    if (typeof params.hashCode == 'string') {
                        getImageData.hashCode = params.hashCode;
                    }

                    if (parseInt(params.width) > 0) {
                        getImageData.width = params.width;
                    }

                    if (parseInt(params.height) > 0) {
                        getImageData.height = params.height;
                    }

                    if (parseInt(params.actual) > 0) {
                        getImageData.actual = params.actual;
                    }

                    if (parseInt(params.downloadable) > 0) {
                        getImageData.downloadable = params.downloadable;
                    }
                }

                httpRequest({
                    url: SERVICE_ADDRESSES.FILESERVER_ADDRESS + SERVICES_PATH.GET_IMAGE,
                    method: 'GET',
                    data: getImageData
                }, function (result) {
                    if (!result.hasError) {
                        var queryString = '?';
                        for (var i in params) {
                            queryString += i + '=' + params[i] + '&';
                        }
                        queryString = queryString.slice(0, -1);
                        var image = SERVICE_ADDRESSES.FILESERVER_ADDRESS + SERVICES_PATH.GET_IMAGE + queryString;
                        callback({
                            hasError: result.hasError,
                            result: image
                        });
                    } else {
                        callback({
                            hasError: true
                        });
                    }
                });
            },

            /**
             * Get File.
             *
             * This functions gets an uploaded file from File Server.
             *
             * @since 3.9.9
             * @access private
             *
             * @param {int}    fileId          ID of file
             * @param {boolean} downloadable    TRUE to be downloadable / False to not
             * @param {string}  hashCode        HashCode of uploaded file
             *
             * @return {object} File Object
             */
            getFile = function (params, callback) {
                var getFileData = {};

                if (params) {
                    if (typeof params.fileId !== 'undefined') {
                        getFileData.fileId = params.fileId;
                    }

                    if (typeof params.hashCode == 'string') {
                        getFileData.hashCode = params.hashCode;
                    }

                    if (typeof params.downloadable == 'boolean') {
                        getFileData.downloadable = params.downloadable;
                    }
                }

                httpRequest({
                    url: SERVICE_ADDRESSES.FILESERVER_ADDRESS +
                        SERVICES_PATH.GET_FILE,
                    method: 'GET',
                    data: getFileData
                }, function (result) {
                    if (!result.hasError) {
                        var queryString = '?';
                        for (var i in params) {
                            queryString += i + '=' + params[i] + '&';
                        }
                        queryString = queryString.slice(0, -1);
                        var file = SERVICE_ADDRESSES.FILESERVER_ADDRESS + SERVICES_PATH.GET_FILE + queryString;
                        callback({
                            hasError: result.hasError,
                            result: file
                        });
                    } else {
                        callback({
                            hasError: true
                        });
                    }
                });
            },

            /**
             * Get File From PodSpace
             *
             * This functions gets an uploaded file from Pod Space File Server.
             *
             * @since 3.9.9
             * @access private
             *
             * @param {string}  hashCode        HashCode of uploaded file
             *
             * @return {object} File Object
             */
            getFileFromPodspace = function (params, callback) {
                var downloadUniqueId = Utility.generateUUID(),
                    getFileData = {};
                if (params) {
                    if (params.hashCode && typeof params.hashCode == 'string') {
                        getFileData.hash = params.hashCode;
                    } else {
                        callback({
                            hasError: true,
                            error: 'Enter a file hash to get'
                        });
                        return;
                    }
                }

                if (params.responseType === 'link') {
                    var returnLink = SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_DOWNLOAD_FILE + `?hash=${params.hashCode}&_token_=${token}&_token_issuer_=1`;

                    callback({
                        hasError: false,
                        type: 'link',
                        result: returnLink
                    });
                } else {

                    httpRequest({
                        url: SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_DOWNLOAD_FILE,
                        method: 'GET',
                        responseType: 'blob',
                        uniqueId: downloadUniqueId,
                        headers: {
                            '_token_': token,
                            '_token_issuer_': 1,
                            // 'Range': 'bytes=100-200'
                        },
                        data: getFileData
                    }, function (result) {
                        if (!result.hasError) {
                            callback({
                                hasError: result.hasError,
                                result: result.result.response,
                                type: 'blob'
                            });
                        } else {
                            callback({
                                hasError: true
                            });
                        }
                    });

                    return {
                        uniqueId: downloadUniqueId,
                        cancel: function () {
                            cancelFileDownload({
                                uniqueId: downloadUniqueId
                            }, function () {
                                consoleLogging && console.log(`"${downloadUniqueId}" - File download has been canceled!`);
                            });
                        }
                    };
                }
            },

            /**
             * Get Image From PodSpace
             *
             * This functions gets an uploaded image from Pod Space File Server.
             *
             * @since 3.9.9
             * @access private
             *
             * @param {string}  hashCode        HashCode of uploaded file
             * @param {string}  size            (1: 100×75, 2: 200×150, 3: 400×300)
             * @param {string}  quality         Image quality betwenn 0.0 anf 1.0
             *
             * @return {object} File Object
             */
            getImageFromPodspace = function (params, callback) {
                var downloadUniqueId = Utility.generateUUID(),
                    getImageData = {
                        size: params.size,
                        quality: params.quality,
                        crop: params.crop
                    };
                if (params) {
                    if (params.hashCode && typeof params.hashCode == 'string') {
                        getImageData.hash = params.hashCode;
                    } else {
                        callback({
                            hasError: true,
                            error: 'Enter a file hash to get'
                        });
                        return;
                    }

                    if (params.responseType === 'link') {
                        var returnLink = SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_DOWNLOAD_IMAGE + `?hash=${params.hashCode}&_token_=${token}&_token_issuer_=1&size=${params.size}&quality=${params.quality}&crop=${params.crop}`;

                        callback({
                            hasError: false,
                            type: 'link',
                            result: returnLink
                        });
                    } else if (params.responseType === 'base64') {
                        httpRequest({
                            url: SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_DOWNLOAD_IMAGE,
                            method: 'GET',
                            uniqueId: downloadUniqueId,
                            responseType: 'blob',
                            headers: {
                                '_token_': token,
                                '_token_issuer_': 1
                            },
                            data: getImageData
                        }, function (result) {
                            if (!result.hasError) {
                                var fr = new FileReader();

                                fr.onloadend = function () {
                                    callback({
                                        hasError: result.hasError,
                                        type: 'base64',
                                        result: fr.result
                                    });
                                }

                                fr.readAsDataURL(result.result.response);
                            } else {
                                callback({
                                    hasError: true
                                });
                            }
                        });

                        return {
                            uniqueId: downloadUniqueId,
                            cancel: function () {
                                cancelFileDownload({
                                    uniqueId: downloadUniqueId
                                }, function () {
                                    consoleLogging && console.log(`"${downloadUniqueId}" - Image download has been canceled!`);
                                });
                            }
                        };
                    } else {
                        httpRequest({
                            url: SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_DOWNLOAD_IMAGE,
                            method: 'GET',
                            responseType: 'blob',
                            uniqueId: downloadUniqueId,
                            headers: {
                                '_token_': token,
                                '_token_issuer_': 1
                            },
                            data: getImageData
                        }, function (result) {
                            if (!result.hasError) {
                                callback({
                                    hasError: result.hasError,
                                    type: 'blob',
                                    result: result.result.response
                                });
                            } else {
                                callback({
                                    hasError: true
                                });
                            }
                        });

                        return {
                            uniqueId: downloadUniqueId,
                            cancel: function () {
                                cancelFileDownload({
                                    uniqueId: downloadUniqueId
                                }, function () {
                                    consoleLogging && console.log(`"${downloadUniqueId}" - Image download has been canceled!`);
                                });
                            }
                        };
                    }
                }
            },

            /**
             * Get Image Download Link From PodSpace
             *
             * This functions gets an uploaded image download link from Pod Space File Server.
             *
             * @since 9.1.3
             * @access private
             *
             * @param {string}  hashCode        HashCode of uploaded file
             *
             * @return {string} Image Link
             */
            getImageDownloadLinkFromPodspace = function (params, callback) {
                if (params) {
                    if (params.hashCode && typeof params.hashCode == 'string') {
                        var downloadUrl = SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_DOWNLOAD_IMAGE + '?hash=' + params.hashCode;
                        callback && callback({
                            hasError: false,
                            downloadUrl: downloadUrl
                        });
                        return downloadUrl;
                    } else {
                        callback && callback({
                            hasError: true,
                            error: 'Enter a image hash to get download link!'
                        });
                    }
                }
            },

            /**
             * Get File Download Link From PodSpace
             *
             * This functions gets an uploaded file download link from Pod Space File Server.
             *
             * @since 9.1.3
             * @access private
             *
             * @param {string}  hashCode        HashCode of uploaded file
             *
             * @return {string} File Link
             */
            getFileDownloadLinkFromPodspace = function (params, callback) {
                if (params) {
                    if (params.hashCode && typeof params.hashCode == 'string') {
                        var downloadUrl = SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_DOWNLOAD_FILE + '?hash=' + params.hashCode;
                        callback && callback({
                            hasError: false,
                            downloadUrl: downloadUrl
                        });
                        return downloadUrl;
                    } else {
                        callback && callback({
                            hasError: true,
                            error: 'Enter a file hash to get download link!'
                        });
                    }
                }
            },

            /**
             * Upload File
             *
             * Upload files to File Server
             *
             * @since 3.9.9
             * @access private
             *
             * @param {string}  fileName        A name for the file
             * @param {file}    file            FILE: the file
             *
             * @link http://docs.pod.land/v1.0.8.0/Developer/CustomPost/605/File
             *
             * @return {object} Uploaded File Object
             */
            uploadFile = function (params, callback) {
                var fileName,
                    fileType,
                    fileSize,
                    fileExtension,
                    uploadUniqueId,
                    uploadThreadId;

                fileName = params.file.name;
                fileType = params.file.type;
                fileSize = params.file.size;
                fileExtension = params.file.name.split('.')
                    .pop();


                var uploadFileData = {};

                if (params) {
                    if (typeof params.file !== 'undefined') {
                        uploadFileData.file = params.file;
                    }

                    if (params.randomFileName) {
                        uploadFileData.fileName = Utility.generateUUID() + '.' + fileExtension;
                    } else {
                        uploadFileData.fileName = fileName;
                    }

                    uploadFileData.fileSize = fileSize;

                    if (parseInt(params.threadId) > 0) {
                        uploadThreadId = params.threadId;
                        uploadFileData.threadId = params.threadId;
                    } else {
                        uploadThreadId = 0;
                        uploadFileData.threadId = 0;
                    }

                    if (typeof params.uniqueId == 'string') {
                        uploadUniqueId = params.uniqueId;
                        uploadFileData.uniqueId = params.uniqueId;
                    } else {
                        uploadUniqueId = Utility.generateUUID();
                        uploadFileData.uniqueId = uploadUniqueId;
                    }

                    if (typeof params.originalFileName == 'string') {
                        uploadFileData.originalFileName = params.originalFileName;
                    } else {
                        uploadFileData.originalFileName = fileName;
                    }
                }

                httpRequest({
                    url: SERVICE_ADDRESSES.FILESERVER_ADDRESS + SERVICES_PATH.UPLOAD_FILE,
                    method: 'POST',
                    headers: {
                        '_token_': token,
                        '_token_issuer_': 1
                    },
                    data: uploadFileData,
                    uniqueId: uploadUniqueId
                }, function (result) {
                    if (!result.hasError) {
                        try {
                            var response = (typeof result.result.responseText == 'string')
                                ? JSON.parse(result.result.responseText)
                                : result.result.responseText;
                            callback({
                                hasError: response.hasError,
                                result: response.result
                            });
                        } catch (e) {
                            callback({
                                hasError: true,
                                errorCode: 999,
                                errorMessage: 'Problem in Parsing result'
                            });
                        }
                    } else {
                        callback({
                            hasError: true,
                            errorCode: result.errorCode,
                            errorMessage: result.errorMessage
                        });
                    }
                });

                return {
                    uniqueId: uploadUniqueId,
                    threadId: uploadThreadId,
                    participant: userInfo,
                    content: {
                        caption: params.content,
                        file: {
                            uniqueId: uploadUniqueId,
                            fileName: fileName,
                            fileSize: fileSize,
                            fileObject: params.file
                        }
                    }
                };
            },

            /**
             * Upload File To Pod Space
             *
             * Upload files to Pod Space Server
             *
             * @since 3.9.9
             * @access private
             *
             * @param {string}  fileName        A name for the file
             * @param {file}    file            FILE: the file
             * @param {string}  userGroupHash   Unique identifier of threads on podspace
             * @param {string}  token           User Token
             * @param {string}  _token_issuer_  Token Issuer
             *
             * @link
                *
                * @return {object} Uploaded File Object
             */
            uploadFileToPodspace = function (params, callback) {
                var fileName,
                    fileType,
                    fileSize,
                    fileExtension,
                    uploadUniqueId,
                    uploadThreadId;

                fileName = params.file.name;
                fileType = params.file.type;
                fileSize = params.file.size;
                fileExtension = params.file.name.split('.').pop();

                var uploadFileData = {};
                if (params) {
                    if (typeof params.file !== 'undefined') {
                        uploadFileData.file = params.file;
                    }
                    if (params.randomFileName) {
                        uploadFileData.filename = Utility.generateUUID() + '.' + fileExtension;
                    } else {
                        uploadFileData.filename = fileName;
                    }
                    uploadFileData.fileSize = fileSize;
                    if (parseInt(params.threadId) > 0) {
                        uploadThreadId = params.threadId;
                        uploadFileData.threadId = params.threadId;
                    } else {
                        uploadThreadId = 0;
                        uploadFileData.threadId = 0;
                    }
                    if (typeof params.uniqueId == 'string') {
                        uploadUniqueId = params.uniqueId;
                        uploadFileData.uniqueId = params.uniqueId;
                    } else {
                        uploadUniqueId = Utility.generateUUID();
                        uploadFileData.uniqueId = uploadUniqueId;
                    }
                    if (typeof params.userGroupHash == 'string') {
                        userGroupHash = params.userGroupHash;
                        uploadFileData.userGroupHash = params.userGroupHash;
                    } else {
                        callback({
                            hasError: true,
                            errorCode: 999,
                            errorMessage: 'You need to enter a userGroupHash to be able to upload on PodSpace!'
                        });
                        return;
                    }
                    if (typeof params.originalFileName == 'string') {
                        uploadFileData.originalFileName = params.originalFileName;
                    } else {
                        uploadFileData.originalFileName = fileName;
                    }
                }
                httpRequest({
                    url: SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_UPLOAD_FILE_TO_USERGROUP,
                    method: 'POST',
                    headers: {
                        '_token_': token,
                        '_token_issuer_': 1
                    },
                    data: uploadFileData,
                    uniqueId: uploadUniqueId
                }, function (result) {
                    if (!result.hasError) {
                        try {
                            var response = (typeof result.result.responseText == 'string')
                                ? JSON.parse(result.result.responseText)
                                : result.result.responseText;
                            callback({
                                hasError: response.hasError,
                                result: response.result
                            });
                        } catch (e) {
                            callback({
                                hasError: true,
                                errorCode: 999,
                                errorMessage: 'Problem in Parsing result'
                            });
                        }
                    } else {
                        callback({
                            hasError: true,
                            errorCode: result.errorCode,
                            errorMessage: result.errorMessage
                        });
                    }
                });
                return {
                    uniqueId: uploadUniqueId,
                    threadId: uploadThreadId,
                    participant: userInfo,
                    content: {
                        caption: params.content,
                        file: {
                            uniqueId: uploadUniqueId,
                            fileName: fileName,
                            fileSize: fileSize,
                            fileObject: params.file
                        }
                    }
                };
            },

            /**
             * Upload File
             *
             * Upload files to File Server
             *
             * @since 3.9.9
             * @access private
             *
             * @param {string}  fileName        A name for the file
             * @param {file}    file            FILE: the file
             *
             * @link http://docs.pod.land/v1.0.8.0/Developer/CustomPost/605/File
             *
             * @return {object} Uploaded File Object
             */
            uploadFileFromUrl = function (params, callback) {
                var uploadUniqueId,
                    uploadThreadId;

                var uploadFileData = {},
                    fileExtension;

                if (params) {
                    if (typeof params.fileUrl !== 'undefined') {
                        uploadFileData.url = params.fileUrl;
                    }

                    if (typeof params.fileExtension !== 'undefined') {
                        fileExtension = params.fileExtension;
                    } else {
                        fileExtension = 'png';
                    }

                    if (typeof params.fileName == 'string') {
                        uploadFileData.filename = params.fileName;
                    } else {
                        uploadFileData.filename = Utility.generateUUID() + '.' + fileExtension;
                    }

                    if (typeof params.uniqueId == 'string') {
                        uploadUniqueId = params.uniqueId;
                    } else {
                        uploadUniqueId = Utility.generateUUID();
                    }

                    if (parseInt(params.threadId) > 0) {
                        uploadThreadId = params.threadId;
                    } else {
                        uploadThreadId = 0;
                    }

                    uploadFileData.isPublic = true;
                }

                httpRequest({
                    url: SERVICE_ADDRESSES.POD_DRIVE_ADDRESS + SERVICES_PATH.DRIVE_UPLOAD_FILE_FROM_URL,
                    method: 'POST',
                    headers: {
                        '_token_': token,
                        '_token_issuer_': 1
                    },
                    data: uploadFileData,
                    uniqueId: uploadUniqueId
                }, function (result) {
                    if (!result.hasError) {
                        try {
                            var response = (typeof result.result.responseText == 'string')
                                ? JSON.parse(result.result.responseText)
                                : result.result.responseText;
                            callback({
                                hasError: response.hasError,
                                result: response.result
                            });
                        } catch (e) {
                            callback({
                                hasError: true,
                                errorCode: 999,
                                errorMessage: 'Problem in Parsing result',
                                error: e
                            });
                        }
                    } else {
                        callback({
                            hasError: true,
                            errorCode: result.errorCode,
                            errorMessage: result.errorMessage
                        });
                    }
                });

                return {
                    uniqueId: uploadUniqueId,
                    threadId: uploadThreadId,
                    participant: userInfo,
                    content: {
                        file: {
                            uniqueId: uploadUniqueId,
                            fileUrl: params.fileUrl
                        }
                    }
                };
            },

            /**
             * Upload Image
             *
             * Upload images to Image Server
             *
             * @since 3.9.9
             * @access private
             *
             * @param {string}  fileName        A name for the file
             * @param {file}    image           FILE: the image file  (if its an image file)
             * @param {float}   xC              Crop Start point x    (if its an image file)
             * @param {float}   yC              Crop Start point Y    (if its an image file)
             * @param {float}   hC              Crop size Height      (if its an image file)
             * @param {float}   wC              Crop size Weight      (if its an image file)
             *
             * @link http://docs.pod.land/v1.0.8.0/Developer/CustomPost/215/UploadImage
             *
             * @return {object} Uploaded Image Object
             */
            uploadImage = function (params, callback) {
                var fileName,
                    fileType,
                    fileSize,
                    fileExtension,
                    uploadUniqueId,
                    uploadThreadId;

                fileName = params.image.name;
                fileType = params.image.type;
                fileSize = params.image.size;
                fileExtension = params.image.name.split('.')
                    .pop();


                if (imageMimeTypes.indexOf(fileType) >= 0 || imageExtentions.indexOf(fileExtension) >= 0) {
                    var uploadImageData = {};

                    if (params) {
                        if (typeof params.image !== 'undefined') {
                            uploadImageData.image = params.image;
                            uploadImageData.file = params.image;
                        }

                        if (params.randomFileName) {
                            uploadImageData.fileName = Utility.generateUUID() + '.' + fileExtension;
                        } else {
                            uploadImageData.fileName = fileName;
                        }

                        uploadImageData.fileSize = fileSize;

                        if (parseInt(params.threadId) > 0) {
                            uploadThreadId = params.threadId;
                            uploadImageData.threadId = params.threadId;
                        } else {
                            uploadThreadId = 0;
                            uploadImageData.threadId = 0;
                        }

                        if (typeof params.uniqueId == 'string') {
                            uploadUniqueId = params.uniqueId;
                            uploadImageData.uniqueId = params.uniqueId;
                        } else {
                            uploadUniqueId = Utility.generateUUID();
                            uploadImageData.uniqueId = uploadUniqueId;
                        }

                        if (typeof params.originalFileName == 'string') {
                            uploadImageData.originalFileName = params.originalFileName;
                        } else {
                            uploadImageData.originalFileName = fileName;
                        }

                        if (parseInt(params.xC) > 0) {
                            uploadImageData.xC = params.xC;
                        }

                        if (parseInt(params.yC) > 0) {
                            uploadImageData.yC = params.yC;
                        }

                        if (parseInt(params.hC) > 0) {
                            uploadImageData.hC = params.hC;
                        }

                        if (parseInt(params.wC) > 0) {
                            uploadImageData.wC = params.wC;
                        }
                    }

                    httpRequest({
                        url: SERVICE_ADDRESSES.FILESERVER_ADDRESS + SERVICES_PATH.UPLOAD_IMAGE,
                        method: 'POST',
                        headers: {
                            '_token_': token,
                            '_token_issuer_': 1
                        },
                        data: uploadImageData,
                        uniqueId: uploadUniqueId
                    }, function (result) {
                        if (!result.hasError) {
                            try {
                                var response = (typeof result.result.responseText == 'string')
                                    ? JSON.parse(result.result.responseText)
                                    : result.result.responseText;
                                if (typeof response.hasError !== 'undefined' && !response.hasError) {
                                    callback({
                                        hasError: response.hasError,
                                        result: response.result
                                    });
                                } else {
                                    callback({
                                        hasError: true,
                                        errorCode: response.errorCode,
                                        errorMessage: response.message
                                    });
                                }
                            } catch (e) {
                                callback({
                                    hasError: true,
                                    errorCode: 6300,
                                    errorMessage: CHAT_ERRORS[6300]
                                });
                            }
                        } else {
                            callback({
                                hasError: true,
                                errorCode: result.errorCode,
                                errorMessage: result.errorMessage
                            });
                        }
                    });

                    return {
                        uniqueId: uploadUniqueId,
                        threadId: uploadThreadId,
                        participant: userInfo,
                        content: {
                            caption: params.content,
                            file: {
                                uniqueId: uploadUniqueId,
                                fileName: fileName,
                                fileSize: fileSize,
                                fileObject: params.file
                            }
                        }
                    };
                } else {
                    callback({
                        hasError: true,
                        errorCode: 6301,
                        errorMessage: CHAT_ERRORS[6301]
                    });
                }
            },

            /**
             * Upload Image To Pod Space Publically
             *
             * Upload images to Pod Space Image Server
             *
             * @since 3.9.9
             * @access private
             *
             * @param {string}  fileName        A name for the file
             * @param {file}    image           FILE: the image file  (if its an image file)
             * @param {float}   xC              Crop Start point x    (if its an image file)
             * @param {float}   yC              Crop Start point Y    (if its an image file)
             * @param {float}   hC              Crop size Height      (if its an image file)
             * @param {float}   wC              Crop size Weight      (if its an image file)
             * @param {string}  token           User Token
             * @param {string}  _token_issuer_  Token Issuer
             *
             * @link https://podspace.pod.ir/apidocs/?srv=/nzh/drive/uploadImage
             *
             * @return {object} Uploaded Image Object
             */
            uploadImageToPodspace = function (params, callback) {
                var fileName,
                    fileType,
                    fileSize,
                    fileWidth = 0,
                    fileHeight = 0,
                    fileExtension,
                    uploadUniqueId,
                    uploadThreadId;

                fileName = params.image.name;
                fileType = params.image.type;
                fileSize = params.image.size;
                fileExtension = params.image.name.split('.')
                    .pop();
                var reader = new FileReader();
                reader.onload = function (e) {
                    var image = new Image();
                    image.onload = function () {
                        fileWidth = this.width;
                        fileHeight = this.height;
                        continueImageUpload(params);
                    };
                    image.src = e.target.result;
                };
                reader.readAsDataURL(params.image);

                continueImageUpload = function (params) {
                    if (imageMimeTypes.indexOf(fileType) >= 0 || imageExtentions.indexOf(fileExtension) >= 0) {
                        var uploadImageData = {};
                        if (params) {
                            if (typeof params.image !== 'undefined') {
                                uploadImageData.file = params.image;
                            } else {
                                callback({
                                    hasError: true,
                                    errorCode: 999,
                                    errorMessage: 'You need to send a image file!'
                                });
                                return;
                            }
                            if (params.randomFileName) {
                                uploadImageData.fileName = Utility.generateUUID() + '.' + fileExtension;
                            } else {
                                uploadImageData.filename = fileName;
                            }
                            uploadImageData.fileSize = fileSize;
                            if (parseInt(params.threadId) > 0) {
                                uploadThreadId = params.threadId;
                                uploadImageData.threadId = params.threadId;
                            } else {
                                uploadThreadId = 0;
                                uploadImageData.threadId = 0;
                            }
                            if (typeof params.uniqueId == 'string') {
                                uploadUniqueId = params.uniqueId;
                                uploadImageData.uniqueId = params.uniqueId;
                            } else {
                                uploadUniqueId = Utility.generateUUID();
                                uploadImageData.uniqueId = uploadUniqueId;
                            }
                            if (typeof params.originalFileName == 'string') {
                                uploadImageData.originalFileName = params.originalFileName;
                            } else {
                                uploadImageData.originalFileName = fileName;
                            }
                            uploadImageData.xC = parseInt(params.xC) || 0;
                            uploadImageData.yC = parseInt(params.yC) || 0;
                            uploadImageData.hC = parseInt(params.hC) || fileHeight;
                            uploadImageData.wC = parseInt(params.wC) || fileWidth;
                        }
                        httpRequest({
                            url: SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_UPLOAD_IMAGE,
                            method: 'POST',
                            headers: {
                                '_token_': token,
                                '_token_issuer_': 1
                            },
                            data: uploadImageData,
                            uniqueId: uploadUniqueId
                        }, function (result) {
                            if (!result.hasError) {
                                try {
                                    var response = (typeof result.result.responseText == 'string')
                                        ? JSON.parse(result.result.responseText)
                                        : result.result.responseText;
                                    if (typeof response.hasError !== 'undefined' && !response.hasError) {
                                        callback({
                                            hasError: response.hasError,
                                            result: response.result
                                        });
                                    } else {
                                        callback({
                                            hasError: true,
                                            errorCode: response.errorCode,
                                            errorMessage: response.message
                                        });
                                    }
                                } catch (e) {
                                    consoleLogging && console.log(e)
                                    callback({
                                        hasError: true,
                                        errorCode: 6300,
                                        errorMessage: CHAT_ERRORS[6300]
                                    });
                                }
                            } else {
                                callback({
                                    hasError: true,
                                    errorCode: result.errorCode,
                                    errorMessage: result.errorMessage
                                });
                            }
                        });
                        return {
                            uniqueId: uploadUniqueId,
                            threadId: uploadThreadId,
                            participant: userInfo,
                            content: {
                                caption: params.content,
                                file: {
                                    uniqueId: uploadUniqueId,
                                    fileName: fileName,
                                    fileSize: fileSize,
                                    fileObject: params.file
                                }
                            }
                        };
                    } else {
                        callback({
                            hasError: true,
                            errorCode: 6301,
                            errorMessage: CHAT_ERRORS[6301]
                        });
                    }
                }
            },

            /**
             * Upload Image To Pod Space
             *
             * Upload images to Pod Space Image Server
             *
             * @since 3.9.9
             * @access private
             *
             * @param {string}  fileName        A name for the file
             * @param {file}    image           FILE: the image file  (if its an image file)
             * @param {float}   xC              Crop Start point x    (if its an image file)
             * @param {float}   yC              Crop Start point Y    (if its an image file)
             * @param {float}   hC              Crop size Height      (if its an image file)
             * @param {float}   wC              Crop size Weight      (if its an image file)
             * @param {string}  userGroupHash   Unique identifier of threads on podspace
             * @param {string}  token           User Token
             * @param {string}  _token_issuer_  Token Issuer
             *
             * @link https://podspace.pod.ir/apidocs/?srv=/userGroup/uploadImage/
             *
             * @return {object} Uploaded Image Object
             */
            uploadImageToPodspaceUserGroup = function (params, callback) {
                var fileName,
                    fileType,
                    fileSize,
                    fileWidth = 0,
                    fileHeight = 0,
                    fileExtension,
                    uploadUniqueId,
                    uploadThreadId;
                var continueImageUpload = function (params) {
                    if (imageMimeTypes.indexOf(fileType) >= 0 || imageExtentions.indexOf(fileExtension) >= 0) {
                        var uploadImageData = {};
                        if (params) {
                            if (typeof params.image !== 'undefined') {
                                uploadImageData.file = params.image;
                            } else {
                                callback({
                                    hasError: true,
                                    errorCode: 999,
                                    errorMessage: 'You need to send a image file!'
                                });
                                return;
                            }
                            if (typeof params.userGroupHash == 'string') {
                                // userGroupHash = params.userGroupHash;
                                uploadImageData.userGroupHash = params.userGroupHash;
                            } else {
                                callback({
                                    hasError: true,
                                    errorCode: 999,
                                    errorMessage: 'You need to enter a userGroupHash to be able to upload on PodSpace!'
                                });
                                return;
                            }
                            if (params.randomFileName) {
                                uploadImageData.fileName = Utility.generateUUID() + '.' + fileExtension;
                            } else {
                                uploadImageData.filename = fileName;
                            }
                            uploadImageData.fileSize = fileSize;
                            if (parseInt(params.threadId) > 0) {
                                uploadThreadId = params.threadId;
                                uploadImageData.threadId = params.threadId;
                            } else {
                                uploadThreadId = 0;
                                uploadImageData.threadId = 0;
                            }
                            if (typeof params.uniqueId == 'string') {
                                uploadUniqueId = params.uniqueId;
                                uploadImageData.uniqueId = params.uniqueId;
                            } else {
                                uploadUniqueId = Utility.generateUUID();
                                uploadImageData.uniqueId = uploadUniqueId;
                            }
                            if (typeof params.originalFileName == 'string') {
                                uploadImageData.originalFileName = params.originalFileName;
                            } else {
                                uploadImageData.originalFileName = fileName;
                            }
                            uploadImageData.xC = parseInt(params.xC) || 0;
                            uploadImageData.yC = parseInt(params.yC) || 0;
                            uploadImageData.hC = parseInt(params.hC) || fileHeight;
                            uploadImageData.wC = parseInt(params.wC) || fileWidth;
                        }
                        httpRequest({
                            url: SERVICE_ADDRESSES.PODSPACE_FILESERVER_ADDRESS + SERVICES_PATH.PODSPACE_UPLOAD_IMAGE_TO_USERGROUP,
                            method: 'POST',
                            headers: {
                                '_token_': token,
                                '_token_issuer_': 1
                            },
                            data: uploadImageData,
                            uniqueId: uploadUniqueId
                        }, function (result) {
                            if (!result.hasError) {
                                try {
                                    var response = (typeof result.result.responseText == 'string')
                                        ? JSON.parse(result.result.responseText)
                                        : result.result.responseText;
                                    if (typeof response.hasError !== 'undefined' && !response.hasError) {
                                        response.result.actualHeight = fileHeight;
                                        response.result.actualWidth = fileWidth;
                                        callback({
                                            hasError: response.hasError,
                                            result: response.result
                                        });
                                    } else {
                                        callback({
                                            hasError: true,
                                            errorCode: response.errorCode,
                                            errorMessage: response.message
                                        });
                                    }
                                } catch (e) {
                                    consoleLogging && console.log(e)
                                    callback({
                                        hasError: true,
                                        errorCode: 6300,
                                        errorMessage: CHAT_ERRORS[6300]
                                    });
                                }
                            } else {
                                callback({
                                    hasError: true,
                                    errorCode: result.errorCode,
                                    errorMessage: result.errorMessage
                                });
                            }
                        });
                        return {
                            uniqueId: uploadUniqueId,
                            threadId: uploadThreadId,
                            participant: userInfo,
                            content: {
                                caption: params.content,
                                file: {
                                    uniqueId: uploadUniqueId,
                                    fileName: fileName,
                                    fileSize: fileSize,
                                    fileObject: params.file
                                }
                            }
                        };
                    } else {
                        callback({
                            hasError: true,
                            errorCode: 6301,
                            errorMessage: CHAT_ERRORS[6301]
                        });
                    }
                }

                fileName = params.image.name;
                fileType = params.image.type;
                fileSize = params.image.size;
                fileExtension = params.image.name.split('.')
                    .pop();
                var reader = new FileReader();
                reader.onload = function (e) {
                    var image = new Image();
                    image.onload = function () {
                        fileWidth = this.width;
                        fileHeight = this.height;
                        continueImageUpload(params);
                    };
                    image.src = e.target.result;
                };
                reader.readAsDataURL(params.image);
            },

            sendFileMessage = function (params, callbacks) {
                var metadata = {file: {}},
                    fileUploadParams = {},
                    fileUniqueId = (typeof params.fileUniqueId == 'string' && params.fileUniqueId.length > 0) ? params.fileUniqueId : Utility.generateUUID();
                if (params) {
                    if (!params.userGroupHash || params.userGroupHash.length === 0 || typeof (params.userGroupHash) !== 'string') {
                        fireEvent('error', {
                            code: 6304,
                            message: CHAT_ERRORS[6304]
                        });
                        return;
                    } else {
                        fileUploadParams.userGroupHash = params.userGroupHash;
                    }
                    return chatUploadHandler({
                        threadId: params.threadId,
                        file: params.file,
                        fileUniqueId: fileUniqueId
                    }, function (uploadHandlerResult, uploadHandlerMetadata, fileType, fileExtension) {
                        fileUploadParams = Object.assign(fileUploadParams, uploadHandlerResult);
                        putInChatUploadQueue({
                            message: {
                                chatMessageVOType: chatMessageVOTypes.MESSAGE,
                                typeCode: params.typeCode,
                                messageType: (params.messageType && typeof params.messageType.toUpperCase() !== 'undefined' && chatMessageTypes[params.messageType.toUpperCase()] > 0) ? chatMessageTypes[params.messageType.toUpperCase()] : 1,
                                subjectId: params.threadId,
                                repliedTo: params.repliedTo,
                                content: params.content,
                                metadata: JSON.stringify(objectDeepMerger(uploadHandlerMetadata, params.metadata)),
                                systemMetadata: JSON.stringify(params.systemMetadata),
                                uniqueId: fileUniqueId,
                                pushMsgType: 3
                            },
                            callbacks: callbacks
                        }, function () {
                            if (imageMimeTypes.indexOf(fileType) >= 0 || imageExtentions.indexOf(fileExtension) >= 0) {
                                uploadImageToPodspaceUserGroup(fileUploadParams, function (result) {
                                    if (!result.hasError) {
                                        // Send onFileUpload callback result
                                        if (typeof callbacks === 'object' && callbacks.hasOwnProperty('onFileUpload')) {
                                            callbacks.onFileUpload && callbacks.onFileUpload({
                                                name: result.result.name,
                                                hashCode: result.result.hashCode,
                                                parentHash: result.result.parentHash,
                                                size: result.result.size,
                                                actualHeight: result.result.actualHeight,
                                                actualWidth: result.result.actualWidth,
                                                link: `https://podspace.pod.ir/nzh/drive/downloadImage?hash=${result.result.hashCode}`
                                            });
                                        }
                                        metadata['name'] = result.result.name;
                                        metadata['fileHash'] = result.result.hashCode;
                                        metadata['file']['name'] = result.result.name;
                                        metadata['file']['fileHash'] = result.result.hashCode;
                                        metadata['file']['hashCode'] = result.result.hashCode;
                                        metadata['file']['parentHash'] = result.result.parentHash;
                                        metadata['file']['size'] = result.result.size;
                                        metadata['file']['actualHeight'] = result.result.actualHeight;
                                        metadata['file']['actualWidth'] = result.result.actualWidth;
                                        metadata['file']['link'] = `https://podspace.pod.ir/nzh/drive/downloadImage?hash=${result.result.hashCode}`;
                                        transferFromUploadQToSendQ(parseInt(params.threadId), fileUniqueId, JSON.stringify(metadata), function () {
                                            chatSendQueueHandler();
                                        });
                                    } else {
                                        deleteFromChatUploadQueue({message: {uniqueId: fileUniqueId}});
                                    }
                                });
                            } else {
                                uploadFileToPodspace(fileUploadParams, function (result) {
                                    if (!result.hasError) {
                                        metadata['fileHash'] = result.result.hashCode;
                                        metadata['name'] = result.result.name;
                                        metadata['file']['name'] = result.result.name;
                                        metadata['file']['fileHash'] = result.result.hashCode;
                                        metadata['file']['hashCode'] = result.result.hashCode;
                                        metadata['file']['parentHash'] = result.result.parentHash;
                                        metadata['file']['size'] = result.result.size;
                                        transferFromUploadQToSendQ(parseInt(params.threadId), fileUniqueId, JSON.stringify(metadata), function () {
                                            chatSendQueueHandler();
                                        });
                                    } else {
                                        deleteFromChatUploadQueue({message: {uniqueId: fileUniqueId}});
                                    }
                                });
                            }
                        });
                    });
                }
            },

            /**
             * Fire Event
             *
             * Fires given Event with given parameters
             *
             * @access private
             *
             * @param {string}  eventName       name of event to be fired
             * @param {object}  param           params to be sent to the event function
             *
             * @return {undefined}
             */
            fireEvent = function (eventName, param) {
                if (eventName === "chatReady") {
                    if (typeof navigator === "undefined") {
                        consoleLogging && console.log("\x1b[90m    ☰ \x1b[0m\x1b[90m%s\x1b[0m", "Chat is Ready 😉");
                    } else {
                        consoleLogging && console.log("%c   Chat is Ready 😉", 'border-left: solid #666 10px; color: #666;');
                    }
                }

                if (eventName === "error" || (eventName === "callEvents" && param.type === "CALL_ERROR")) {
                    try {
                        throw new PodChatErrorException(param);
                    } catch (err) {
                        if (!!Sentry) {
                            Sentry.setExtra('errorMessage', err.message);
                            Sentry.setExtra('errorCode', err.code);
                            Sentry.setExtra('uniqueId', err.uniqueId);
                            Sentry.setExtra('token', err.token);
                            Sentry.captureException(err.error, {
                                logger: eventName
                            });
                        }
                    }
                }

                for (var id in eventCallbacks[eventName]) {
                    eventCallbacks[eventName][id](param);
                }
            },

            PodChatErrorException = function (error) {
                this.code = error.error.code;
                this.message = error.error.message;
                this.uniqueId = error.uniqueId;
                this.token = token;
                this.error = JSON.stringify(error.error);
            },

            /**
             * Delete Cache Database
             *
             * This function truncates all tables of cache Database
             * and drops whole tables
             *
             * @access private
             *
             * @return {undefined}
             */
            deleteCacheDatabases = function () {
                if (db) {
                    db.close();
                }

                if (queueDb) {
                    queueDb.close();
                }

                var chatCacheDB = new Dexie('podChat');
                if (chatCacheDB) {
                    chatCacheDB.delete()
                        .then(function () {
                            consoleLogging && console.log('PodChat Database successfully deleted!');

                            var queueDb = new Dexie('podQueues');
                            if (queueDb) {
                                queueDb.delete()
                                    .then(function () {
                                        consoleLogging && console.log('PodQueues Database successfully deleted!');
                                        startCacheDatabases();
                                    })
                                    .catch(function (err) {
                                        consoleLogging && console.log(err);
                                    });
                            }
                        })
                        .catch(function (err) {
                            consoleLogging && console.log(err);
                        });
                }
            },

            /**
             * Clear Cache Database of Some User
             *
             * This function removes everything in cache
             * for one specific user
             *
             * @access private
             *
             * @return {undefined}
             */
            clearCacheDatabasesOfUser = function (callback) {
                if (db && !cacheDeletingInProgress) {
                    cacheDeletingInProgress = true;
                    db.threads
                        .where('owner')
                        .equals(parseInt(userInfo.id))
                        .delete()
                        .then(function () {
                            consoleLogging && console.log('Threads table deleted');

                            db.contacts
                                .where('owner')
                                .equals(parseInt(userInfo.id))
                                .delete()
                                .then(function () {
                                    consoleLogging && console.log('Contacts table deleted');

                                    db.messages
                                        .where('owner')
                                        .equals(parseInt(userInfo.id))
                                        .delete()
                                        .then(function () {
                                            consoleLogging && console.log('Messages table deleted');

                                            db.participants
                                                .where('owner')
                                                .equals(parseInt(userInfo.id))
                                                .delete()
                                                .then(function () {
                                                    consoleLogging && console.log('Participants table deleted');

                                                    db.messageGaps
                                                        .where('owner')
                                                        .equals(parseInt(userInfo.id))
                                                        .delete()
                                                        .then(function () {
                                                            consoleLogging && console.log('MessageGaps table deleted');
                                                            cacheDeletingInProgress = false;
                                                            callback && callback();
                                                        });
                                                });
                                        });
                                });
                        })
                        .catch(function (error) {
                            fireEvent('error', {
                                code: error.code,
                                message: error.message,
                                error: error
                            });
                        });
                }
            },

            /**
             * Initialize Cache Database
             *
             * if client's environment is capable of supporting indexedDB
             * and the hasCache attribute set to be true, we created
             * a indexedDB instance based on DexieDb and Initialize
             * client sde caching
             *
             * @return {undefined}
             */
            startCacheDatabases = function (callback) {
                if (hasCache) {
                    queueDb = new Dexie('podQueues');

                    queueDb.version(1)
                        .stores({
                            waitQ: '[owner+threadId+uniqueId], owner, threadId, uniqueId, message'
                        });

                    if (enableCache) {
                        db = new Dexie('podChat');

                        db.version(1)
                            .stores({
                                users: '&id, name, cellphoneNumber, keyId',
                                contacts: '[owner+id], id, owner, uniqueId, userId, cellphoneNumber, email, firstName, lastName, expireTime',
                                threads: '[owner+id] ,id, owner, title, time, pin, [owner+time]',
                                participants: '[owner+id], id, owner, threadId, notSeenDuration, admin, auditor, name, contactName, email, expireTime',
                                messages: '[owner+id], id, owner, threadId, time, [threadId+id], [threadId+owner+time]',
                                messageGaps: '[owner+id], [owner+waitsFor], id, waitsFor, owner, threadId, time, [threadId+owner+time]',
                                contentCount: 'threadId, contentCount'
                            });

                        db.open()
                            .catch(function (e) {
                                consoleLogging && console.log('Open failed: ' + e.stack);
                            });

                        db.on('ready', function () {
                            isCacheReady = true;
                            callback && callback();
                        }, true);

                        db.on('versionchange', function (event) {
                            window.location.reload();
                        });
                    } else {
                        callback && callback();
                    }
                } else {
                    consoleLogging && console.log(CHAT_ERRORS[6600]);
                    callback && callback();
                }
            },

            /**
             * Get Chat Send Queue
             *
             * This function returns chat send queue
             *
             * @access private
             *
             * @return {array}  An array of messages on sendQueue
             */
            getChatSendQueue = function (threadId, callback) {
                if (threadId) {
                    var tempSendQueue = [];

                    for (var i = 0; i < chatSendQueue.length; i++) {
                        if (chatSendQueue[i].threadId === threadId) {
                            tempSendQueue.push(chatSendQueue[i]);
                        }
                    }
                    callback && callback(tempSendQueue);
                } else {
                    callback && callback(chatSendQueue);
                }
            },

            /**
             * Get Chat Wait Queue
             *
             * This function checks if cache is enbled on client's
             * machine, and if it is, retrieves WaitQueue from
             * cache. Otherwise returns WaitQueue from RAM
             * After getting failed messages from cache or RAM
             * we should check them with server to be sure if
             * they have been sent already or not?
             *
             * @access private
             *
             * @return {array}  An array of messages on Wait Queue
             */
            getChatWaitQueue = function (threadId, active, callback) {
                if (active && threadId > 0) {
                    if (hasCache && typeof queueDb == 'object' && !forceWaitQueueInMemory) {
                        queueDb.waitQ.where('threadId')
                            .equals(threadId)
                            .and(function (item) {
                                return item.owner === parseInt(userInfo.id);
                            })
                            .toArray()
                            .then(function (waitQueueOnCache) {
                                var uniqueIds = [];

                                for (var i = 0; i < waitQueueOnCache.length; i++) {
                                    uniqueIds.push(waitQueueOnCache[i].uniqueId);
                                }

                                if (uniqueIds.length && chatState) {
                                    sendMessage({
                                        chatMessageVOType: chatMessageVOTypes.GET_HISTORY,
                                        content: {
                                            uniqueIds: uniqueIds
                                        },
                                        subjectId: threadId
                                    }, {
                                        onResult: function (result) {
                                            if (!result.hasError) {
                                                var messageContent = result.result;

                                                /**
                                                 * Delete those messages from wait
                                                 * queue which are already on the
                                                 * server databases
                                                 */
                                                for (var i = 0; i < messageContent.length; i++) {
                                                    for (var j = 0; j < uniqueIds.length; j++) {
                                                        if (uniqueIds[j] === messageContent[i].uniqueId) {
                                                            deleteFromChatWaitQueue(messageContent[i], function () {
                                                            });
                                                            uniqueIds.splice(j, 1);
                                                            waitQueueOnCache.splice(j, 1);
                                                        }
                                                    }
                                                }

                                                /**
                                                 * Delete those messages from wait
                                                 * queue which are in the send
                                                 * queue and are going to be sent
                                                 */
                                                for (var i = 0; i < chatSendQueue.length; i++) {
                                                    for (var j = 0; j < uniqueIds.length; j++) {
                                                        if (uniqueIds[j] === chatSendQueue[i].message.uniqueId) {
                                                            deleteFromChatWaitQueue(chatSendQueue[i].message, function () {
                                                            });
                                                            uniqueIds.splice(j, 1);
                                                            waitQueueOnCache.splice(j, 1);
                                                        }
                                                    }
                                                }

                                                callback && callback(waitQueueOnCache);
                                            }
                                        }
                                    });
                                } else {
                                    callback && callback(waitQueueOnCache);
                                }
                            })
                            .catch(function (error) {
                                fireEvent('error', {
                                    code: error.code,
                                    message: error.message,
                                    error: error
                                });
                            });
                    } else {
                        var uniqueIds = [],
                            queueToBeSent = [];

                        for (var i = 0; i < chatWaitQueue.length; i++) {
                            if (chatWaitQueue[i].subjectId == threadId) {
                                queueToBeSent.push(chatWaitQueue[i]);
                                uniqueIds.push(chatWaitQueue[i].uniqueId);
                            }
                        }

                        if (uniqueIds.length) {
                            sendMessage({
                                chatMessageVOType: chatMessageVOTypes.GET_HISTORY,
                                content: {
                                    uniqueIds: uniqueIds
                                },
                                subjectId: threadId
                            }, {
                                onResult: function (result) {
                                    if (!result.hasError) {
                                        var messageContent = result.result;

                                        for (var i = 0; i < messageContent.length; i++) {
                                            for (var j = 0; j < uniqueIds.length; j++) {
                                                if (uniqueIds[j] === messageContent[i].uniqueId) {
                                                    uniqueIds.splice(j, 1);
                                                    queueToBeSent.splice(j, 1);
                                                }
                                            }
                                        }
                                        callback && callback(queueToBeSent);
                                    }
                                }
                            });
                        } else {
                            callback && callback([]);
                        }
                    }
                } else {
                    callback && callback([]);
                }
            },

            /**
             * Get Chat Upload Queue
             *
             * This function checks if cache is enabled on client's
             * machine, and if it is, retrieves uploadQueue from
             * cache. Otherwise returns uploadQueue from RAM
             *
             * @access private
             *
             * @return {array}  An array of messages on uploadQueue
             */
            getChatUploadQueue = function (threadId, callback) {
                var uploadQ = [];
                for (var i = 0; i < chatUploadQueue.length; i++) {
                    if (parseInt(chatUploadQueue[i].message.subjectId) === threadId) {
                        uploadQ.push(chatUploadQueue[i]);
                    }
                }

                callback && callback(uploadQ);
            },

            /**
             * Delete an Item from Chat Send Queue
             *
             * This function gets an item and deletes it
             * from Chat Send Queue
             *
             * @access private
             *
             * @return {undefined}
             */
            deleteFromChatSentQueue = function (item, callback) {
                for (var i = 0; i < chatSendQueue.length; i++) {
                    if (chatSendQueue[i].message.uniqueId === item.message.uniqueId) {
                        chatSendQueue.splice(i, 1);
                    }
                }
                callback && callback();
            },

            /**
             * Delete an Item from Chat Wait Queue
             *
             * This function gets an item and deletes it
             * from Chat Wait Queue, from either cached
             * queue or the queue on RAM memory
             *
             * @access private
             *
             * @return {undefined}
             */
            deleteFromChatWaitQueue = function (item, callback) {
                if (hasCache && typeof queueDb == 'object' && !forceWaitQueueInMemory) {
                    queueDb.waitQ.where('uniqueId')
                        .equals(item.uniqueId)
                        .and(function (item) {
                            return item.owner === parseInt(userInfo.id);
                        })
                        .delete()
                        .then(function () {
                            callback && callback();
                        })
                        .catch(function (error) {
                            fireEvent('error', {
                                code: error.code,
                                message: error.message,
                                error: error
                            });
                        });
                } else {
                    for (var i = 0; i < chatWaitQueue.length; i++) {
                        if (chatWaitQueue[i].uniqueId === item.uniqueId) {
                            chatWaitQueue.splice(i, 1);
                        }
                    }
                    callback && callback();
                }
            },

            /**
             * Delete an Item from Chat Upload Queue
             *
             * This function gets an item and deletes it
             * from Chat Upload Queue
             *
             * @access private
             *
             * @return {undefined}
             */
            deleteFromChatUploadQueue = function (item, callback) {
                for (var i = 0; i < chatUploadQueue.length; i++) {
                    if (chatUploadQueue[i].message.uniqueId === item.message.uniqueId) {
                        chatUploadQueue.splice(i, 1);
                    }
                }
                callback && callback();
            },

            deleteThreadFailedMessagesFromWaitQueue = function (threadId, callback) {
                if (hasCache && typeof queueDb == 'object' && !forceWaitQueueInMemory) {
                    queueDb.waitQ.where('threadId')
                        .equals(threadId)
                        .and(function (item) {
                            return item.owner === parseInt(userInfo.id);
                        })
                        .delete()
                        .then(function () {
                            callback && callback();
                        })
                        .catch(function (error) {
                            fireEvent('error', {
                                code: error.code,
                                message: error.message,
                                error: error
                            });
                        });
                } else {
                    for (var i = 0; i < chatWaitQueue.length; i++) {
                        if (chatWaitQueue[i].uniqueId === item.uniqueId) {
                            chatWaitQueue.splice(i, 1);
                        }
                    }
                    callback && callback();
                }
            },

            /**
             * Push Message Into Send Queue
             *
             * This functions takes a message and puts it
             * into chat's send queue
             *
             * @access private
             *
             * @param {object}    params    The Message and its callbacks to be enqueued
             *
             * @return {undefined}
             */
            putInChatSendQueue = function (params, callback, skip) {
                chatSendQueue.push(params);

                if (!skip) {
                    var time = new Date().getTime();
                    params.message.time = time;
                    params.message.timeNanos = (time % 1000) * 1000000;

                    putInChatWaitQueue(params.message, function () {
                        callback && callback();
                    });
                }
            },

            /**
             * Put an Item inside Chat Wait Queue
             *
             * This function takes an item and puts it
             * inside Chat Wait Queue, either on cached
             * wait queue or the wait queue on RAM memory
             *
             * @access private
             *
             * @return {undefined}
             */
            putInChatWaitQueue = function (item, callback) {
                if (item.uniqueId !== '') {
                    var waitQueueUniqueId = (typeof item.uniqueId == 'string') ? item.uniqueId : (Array.isArray(item.uniqueId)) ? item.uniqueId[0] : null;

                    if (waitQueueUniqueId != null) {
                        if (hasCache && typeof queueDb == 'object' && !forceWaitQueueInMemory) {
                            queueDb.waitQ
                                .put({
                                    threadId: parseInt(item.subjectId),
                                    uniqueId: waitQueueUniqueId,
                                    owner: parseInt(userInfo.id),
                                    message: Utility.crypt(item, cacheSecret)
                                })
                                .then(function () {
                                    callback && callback();
                                })
                                .catch(function (error) {
                                    fireEvent('error', {
                                        code: error.code,
                                        message: error.message,
                                        error: error
                                    });
                                });
                        } else {
                            consoleLogging && console.log('Forced to use in memory cache');
                            item.uniqueId = waitQueueUniqueId;
                            chatWaitQueue.push(item);
                            callback && callback();
                        }
                    }
                }
            },

            getItemFromChatWaitQueue = function (uniqueId, callback) {
                if (hasCache && typeof queueDb == 'object' && !forceWaitQueueInMemory) {
                    queueDb.waitQ.where('uniqueId')
                        .equals(uniqueId)
                        .and(function (item) {
                            return item.owner === parseInt(userInfo.id);
                        })
                        .toArray()
                        .then(function (messages) {
                            var decryptedEnqueuedMessage = Utility.jsonParser(chatDecrypt(messages[0].message, cacheSecret));
                            if (decryptedEnqueuedMessage.uniqueId === uniqueId) {
                                var message = formatDataToMakeMessage(messages[0].threadId, {
                                    uniqueId: decryptedEnqueuedMessage.uniqueId,
                                    ownerId: userInfo.id,
                                    message: decryptedEnqueuedMessage.content,
                                    metadata: decryptedEnqueuedMessage.metadata,
                                    systemMetadata: decryptedEnqueuedMessage.systemMetadata,
                                    replyInfo: decryptedEnqueuedMessage.replyInfo,
                                    forwardInfo: decryptedEnqueuedMessage.forwardInfo,
                                    participant: userInfo,
                                    time: decryptedEnqueuedMessage.time,
                                    timeNanos: decryptedEnqueuedMessage.timeNanos
                                });
                                callback && callback(message);
                            }
                        })
                        .catch(function (error) {
                            fireEvent('error', {
                                code: error.code,
                                message: error.message,
                                error: error
                            });
                        });
                } else {
                    for (var i = 0; i < chatWaitQueue.length; i++) {
                        if (chatWaitQueue[i].uniqueId === uniqueId) {
                            var decryptedEnqueuedMessage = chatWaitQueue[i];
                            var time = new Date().getTime();
                            var message = formatDataToMakeMessage(decryptedEnqueuedMessage.threadId, {
                                uniqueId: decryptedEnqueuedMessage.uniqueId,
                                ownerId: userInfo.id,
                                message: decryptedEnqueuedMessage.content,
                                metadata: decryptedEnqueuedMessage.metadata,
                                systemMetadata: decryptedEnqueuedMessage.systemMetadata,
                                replyInfo: decryptedEnqueuedMessage.replyInfo,
                                forwardInfo: decryptedEnqueuedMessage.forwardInfo,
                                participant: userInfo,
                                time: time,
                                timeNanos: (time % 1000) * 1000000
                            });

                            callback && callback(message);
                            break;
                        }
                    }
                }
            },

            /**
             * Put an Item inside Chat Upload Queue
             *
             * This function takes an item and puts it
             * inside Chat upload Queue
             *
             * @access private
             *
             * @return {undefined}
             */
            putInChatUploadQueue = function (params, callback) {
                chatUploadQueue.push(params);
                callback && callback();
            },

            /**
             * Transfer an Item from uploadQueue to sendQueue
             *
             * This function takes an uniqueId, finds that item
             * inside uploadQ. takes it's uploaded metadata and
             * attaches them to the message. Finally removes item
             * from uploadQueue and pushes it inside sendQueue
             *
             * @access private
             *
             * @return {undefined}
             */
            transferFromUploadQToSendQ = function (threadId, uniqueId, metadata, callback) {
                getChatUploadQueue(threadId, function (uploadQueue) {
                    for (var i = 0; i < uploadQueue.length; i++) {
                        if (uploadQueue[i].message.uniqueId === uniqueId) {
                            try {
                                var message = uploadQueue[i].message,
                                    callbacks = uploadQueue[i].callbacks;
                                let oldMetadata = JSON.parse(message.metadata),
                                    newMetadata = JSON.parse(metadata);
                                var finalMetaData = objectDeepMerger(newMetadata, oldMetadata);

                                if (typeof message !== 'undefined' && message && typeof message.content !== 'undefined' && message.content && message.content.hasOwnProperty('message')) {
                                    message.content.message['metadata'] = JSON.stringify(finalMetaData);
                                }

                                if (typeof message !== 'undefined' && message && typeof message.content !== 'undefined' && message.content && message.content.hasOwnProperty('metadata')) {
                                    message.content['metadata'] = JSON.stringify(finalMetaData);
                                }

                                if (message.chatMessageVOType === 21) {
                                    getImageDownloadLinkFromPodspace({
                                        hashCode: finalMetaData.fileHash
                                    }, function (result) {
                                        if (!result.hasError) {
                                            message.content.image = result.downloadUrl;
                                        }
                                    });
                                }

                                message.metadata = JSON.stringify(finalMetaData);
                            } catch (e) {
                                consoleLogging && console.log(e);
                            }
                            deleteFromChatUploadQueue(uploadQueue[i],
                                function () {
                                    putInChatSendQueue({
                                        message: message,
                                        callbacks: callbacks
                                    }, function () {
                                        callback && callback();
                                    });
                                });
                            break;
                        }
                    }
                });
            },

            /**
             * Decrypt Encrypted strings using secret key and salt
             *
             * @param string    String to get decrypted
             * @param secret    Cache Secret
             * @param salt      Salt used while string was getting encrypted
             *
             * @return  string  Decrypted string
             */
            chatDecrypt = function (string, secret, salt) {
                var decryptedString = Utility.decrypt(string, secret, salt);
                if (!decryptedString.hasError) {
                    return decryptedString.result;
                } else {
                    /**
                     * If there is a problem with decrypting cache
                     * Some body is trying to decrypt cache with wrong key
                     * or cacheSecret has been expired, so we should truncate
                     * cache databases to avoid attacks.
                     *
                     * But before deleting cache database we should make
                     * sure that cacheSecret has been retrieved from server
                     * and is ready. If so, and cache is still not decryptable,
                     * there is definitely something wrong with the key; so we are
                     * good to go and delete cache databases.
                     */
                    if (typeof secret !== 'undefined' && secret !== '') {
                        if (db) {
                            db.threads
                                .where('owner')
                                .equals(parseInt(userInfo.id))
                                .count()
                                .then(function (threadsCount) {
                                    if (threadsCount > 0) {
                                        clearCacheDatabasesOfUser(function () {
                                            consoleLogging && console.log('All cache databases have been cleared.');
                                        });
                                    }
                                })
                                .catch(function (e) {
                                    consoleLogging && console.log(e);
                                });
                        }
                    }

                    return '{}';
                }
            },

            objectDeepMerger = function (...args) {
                var target = {};
                var merger = function (obj) {
                    for (var prop in obj) {
                        if (obj.hasOwnProperty(prop)) {
                            if (Object.prototype.toString.call(obj[prop]) === '[object Object]') {
                                target[prop] = objectDeepMerger(target[prop], obj[prop]);
                            } else {
                                target[prop] = obj[prop];
                            }
                        }
                    }
                };
                for (var i = 0; i < args.length; i++) {
                    merger(args[i]);
                }
                return target;
            },

            setRoleToUser = function (params, callback) {
                var setRoleData = {
                    chatMessageVOType: chatMessageVOTypes.SET_ROLE_TO_USER,
                    typeCode: params.typeCode,
                    content: [],
                    pushMsgType: 3,
                    token: token
                };

                if (params) {
                    if (parseInt(params.threadId) > 0) {
                        setRoleData.subjectId = params.threadId;
                    }

                    if (params.admins && Array.isArray(params.admins)) {
                        for (var i = 0; i < params.admins.length; i++) {
                            var temp = {};
                            if (parseInt(params.admins[i].userId) > 0) {
                                temp.userId = params.admins[i].userId;
                            }

                            if (Array.isArray(params.admins[i].roles)) {
                                temp.roles = params.admins[i].roles;
                            }

                            setRoleData.content.push(temp);
                        }

                        setRoleData.content = JSON.stringify(setRoleData.content);
                    }
                }

                return sendMessage(setRoleData, {
                    onResult: function (result) {
                        callback && callback(result);
                    }
                });
            },

            removeRoleFromUser = function (params, callback) {
                var setAdminData = {
                    chatMessageVOType: chatMessageVOTypes.REMOVE_ROLE_FROM_USER,
                    typeCode: params.typeCode,
                    content: [],
                    pushMsgType: 3,
                    token: token
                };

                if (params) {
                    if (parseInt(params.threadId) > 0) {
                        setAdminData.subjectId = params.threadId;
                    }

                    if (params.admins && Array.isArray(params.admins)) {
                        for (var i = 0; i < params.admins.length; i++) {
                            var temp = {};
                            if (parseInt(params.admins[i].userId) > 0) {
                                temp.userId = params.admins[i].userId;
                            }

                            if (Array.isArray(params.admins[i].roles)) {
                                temp.roles = params.admins[i].roles;
                            }

                            setAdminData.content.push(temp);
                        }

                        setAdminData.content = JSON.stringify(setAdminData.content);
                    }
                }

                return sendMessage(setAdminData, {
                    onResult: function (result) {
                        callback && callback(result);
                    }
                });
            },

            unPinMessage = function (params, callback) {
                return sendMessage({
                    chatMessageVOType: chatMessageVOTypes.UNPIN_MESSAGE,
                    typeCode: params.typeCode,
                    subjectId: params.messageId,
                    content: JSON.stringify({
                        'notifyAll': (typeof params.notifyAll === 'boolean') ? params.notifyAll : false
                    }),
                    pushMsgType: 3,
                    token: token
                }, {
                    onResult: function (result) {
                        callback && callback(result);
                    }
                });
            },

            chatUploadHandler = function (params, callbacks) {
                if (typeof params.file !== 'undefined') {
                    var fileName,
                        fileType,
                        fileSize,
                        fileExtension,
                        chatUploadHandlerResult = {},
                        metadata = {file: {}},
                        fileUniqueId = params.fileUniqueId;

                    fileName = params.file.name;
                    fileType = params.file.type;
                    fileSize = params.file.size;
                    fileExtension = params.file.name.split('.')
                        .pop();

                    fireEvent('fileUploadEvents', {
                        threadId: params.threadId,
                        uniqueId: fileUniqueId,
                        state: 'NOT_STARTED',
                        progress: 0,
                        fileInfo: {
                            fileName: fileName,
                            fileSize: fileSize
                        },
                        fileObject: params.file
                    });
                    /**
                     * File is a valid Image
                     * Should upload to image server
                     */
                    if (imageMimeTypes.indexOf(fileType) >= 0 || imageExtentions.indexOf(fileExtension) >= 0) {
                        chatUploadHandlerResult.image = params.file;
                        if (params.xC >= 0) {
                            fileUploadParams.xC = params.xC;
                        }
                        if (params.yC >= 0) {
                            fileUploadParams.yC = params.yC;
                        }
                        if (params.hC > 0) {
                            fileUploadParams.hC = params.hC;
                        }
                        if (params.wC > 0) {
                            fileUploadParams.wC = params.wC;
                        }
                    } else {
                        chatUploadHandlerResult.file = params.file;
                    }
                    metadata['file']['originalName'] = fileName;
                    metadata['file']['mimeType'] = fileType;
                    metadata['file']['size'] = fileSize;
                    chatUploadHandlerResult.threadId = params.threadId;
                    chatUploadHandlerResult.uniqueId = fileUniqueId;
                    chatUploadHandlerResult.fileObject = params.file;
                    chatUploadHandlerResult.originalFileName = fileName;
                    callbacks && callbacks(chatUploadHandlerResult, metadata, fileType, fileExtension);
                } else {
                    fireEvent('error', {
                        code: 6302,
                        message: CHAT_ERRORS[6302]
                    });
                }
                return {
                    uniqueId: fileUniqueId,
                    threadId: params.threadId,
                    participant: userInfo,
                    content: {
                        caption: params.content,
                        file: {
                            uniqueId: fileUniqueId,
                            fileName: fileName,
                            fileSize: fileSize,
                            fileObject: params.file
                        }
                    }
                };
            },

            cancelFileDownload = function (params, callback) {
                if (params) {
                    if (typeof params.uniqueId == 'string') {
                        var uniqueId = params.uniqueId;
                        httpRequestObject[eval('uniqueId')] && httpRequestObject[eval('uniqueId')].abort();
                        httpRequestObject[eval('uniqueId')] && delete (httpRequestObject[eval('uniqueId')]);
                        callback && callback(uniqueId);
                    }
                }
            },

            cancelFileUpload = function (params, callback) {
                if (params) {
                    if (typeof params.uniqueId == 'string') {
                        var uniqueId = params.uniqueId;
                        httpRequestObject[eval('uniqueId')] && httpRequestObject[eval('uniqueId')].abort();
                        httpRequestObject[eval('uniqueId')] && delete (httpRequestObject[eval('uniqueId')]);

                        deleteFromChatUploadQueue({
                            message: {
                                uniqueId: uniqueId
                            }
                        }, callback);
                    }
                }
            },

            cancelMessage = function (uniqueId, callback) {
                deleteFromChatSentQueue({
                    message: {
                        uniqueId: uniqueId
                    }
                }, function () {
                    deleteFromChatWaitQueue({
                        uniqueId: uniqueId
                    }, callback);
                });
            },

            callReceived = function (params, callback) {
                var receiveCallData = {
                    chatMessageVOType: chatMessageVOTypes.RECIVE_CALL_REQUEST,
                    typeCode: params.typeCode,
                    pushMsgType: 3,
                    token: token
                };

                if (params) {
                    if (typeof +params.callId === 'number' && params.callId > 0) {
                        receiveCallData.subjectId = +params.callId;
                    } else {
                        fireEvent('error', {
                            code: 999,
                            message: 'Invalid call id!'
                        });
                        return;
                    }
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'No params have been sent to ReceiveCall()'
                    });
                    return;
                }

                return sendMessage(receiveCallData, {
                    onResult: function (result) {
                        callback && callback(result);
                    }
                });
            },

            endCall = function (params, callback) {
                var endCallData = {
                    chatMessageVOType: chatMessageVOTypes.END_CALL_REQUEST,
                    typeCode: params.typeCode,
                    pushMsgType: 3,
                    token: token
                };

                if (params) {
                    if (typeof +params.callId === 'number' && params.callId > 0) {
                        endCallData.subjectId = +params.callId;
                    } else {
                        fireEvent('error', {
                            code: 999,
                            message: 'Invalid call id!'
                        });
                        return;
                    }
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'No params have been sent to End the call!'
                    });
                    return;
                }

                callStop();

                return sendMessage(endCallData, {
                    onResult: function (result) {
                        callback && callback(result);
                    }
                });
            },

            mapReverse = function (params, callback) {
                var data = {};

                if (params) {
                    if (parseFloat(params.lat) > 0) {
                        data.lat = params.lat;
                    }

                    if (parseFloat(params.lng) > 0) {
                        data.lng = params.lng;
                    }

                    data.uniqueId = Utility.generateUUID();
                }

                var requestParams = {
                    url: SERVICE_ADDRESSES.MAP_ADDRESS + SERVICES_PATH.REVERSE,
                    method: 'GET',
                    data: data,
                    headers: {
                        'Api-Key': mapApiKey
                    }
                };

                httpRequest(requestParams, function (result) {
                    if (!result.hasError) {
                        var responseData = JSON.parse(result.result.responseText);

                        var returnData = {
                            hasError: result.hasError,
                            cache: result.cache,
                            errorMessage: result.message,
                            errorCode: result.errorCode,
                            result: responseData
                        };

                        callback && callback(returnData);

                    } else {
                        fireEvent('error', {
                            code: result.errorCode,
                            message: result.errorMessage,
                            error: result
                        });
                    }
                });
            },

            mapSearch = function (params, callback) {
                var data = {};

                if (params) {
                    if (typeof params.term === 'string') {
                        data.term = params.term;
                    }

                    if (parseFloat(params.lat) > 0) {
                        data.lat = params.lat;
                    }

                    if (parseFloat(params.lng) > 0) {
                        data.lng = params.lng;
                    }

                    data.uniqueId = Utility.generateUUID();
                }

                var requestParams = {
                    url: SERVICE_ADDRESSES.MAP_ADDRESS + SERVICES_PATH.SEARCH,
                    method: 'GET',
                    data: data,
                    headers: {
                        'Api-Key': mapApiKey
                    }
                };

                httpRequest(requestParams, function (result) {
                    if (!result.hasError) {
                        var responseData = JSON.parse(result.result.responseText);

                        var returnData = {
                            hasError: result.hasError,
                            cache: result.cache,
                            errorMessage: result.message,
                            errorCode: result.errorCode,
                            result: responseData
                        };

                        callback && callback(returnData);

                    } else {
                        fireEvent('error', {
                            code: result.errorCode,
                            message: result.errorMessage,
                            error: result
                        });
                    }
                });
            },

            mapRouting = function (params, callback) {
                var data = {};

                if (params) {
                    if (typeof params.alternative === 'boolean') {
                        data.alternative = params.alternative;
                    } else {
                        data.alternative = true;
                    }

                    if (typeof params.origin === 'object') {
                        if (parseFloat(params.origin.lat) > 0 && parseFloat(params.origin.lng)) {
                            data.origin = params.origin.lat + ',' + parseFloat(params.origin.lng);
                        } else {
                            consoleLogging && console.log('No origin has been selected!');
                        }
                    }

                    if (typeof params.destination === 'object') {
                        if (parseFloat(params.destination.lat) > 0 && parseFloat(params.destination.lng)) {
                            data.destination = params.destination.lat + ',' + parseFloat(params.destination.lng);
                        } else {
                            consoleLogging && console.log('No destination has been selected!');
                        }
                    }

                    data.uniqueId = Utility.generateUUID();
                }

                var requestParams = {
                    url: SERVICE_ADDRESSES.MAP_ADDRESS + SERVICES_PATH.ROUTING,
                    method: 'GET',
                    data: data,
                    headers: {
                        'Api-Key': mapApiKey
                    }
                };

                httpRequest(requestParams, function (result) {
                    if (!result.hasError) {
                        var responseData = JSON.parse(result.result.responseText);

                        var returnData = {
                            hasError: result.hasError,
                            cache: result.cache,
                            errorMessage: result.message,
                            errorCode: result.errorCode,
                            result: responseData
                        };

                        callback && callback(returnData);

                    } else {
                        fireEvent('error', {
                            code: result.errorCode,
                            message: result.errorMessage,
                            error: result
                        });
                    }
                });
            },

            mapStaticImage = function (params, callback) {
                var data = {},
                    url = SERVICE_ADDRESSES.MAP_ADDRESS + SERVICES_PATH.STATIC_IMAGE,
                    hasError = false;

                if (params) {
                    if (typeof params.type === 'string') {
                        data.type = params.type;
                    } else {
                        data.type = 'standard-night';
                    }

                    if (parseInt(params.zoom) > 0) {
                        data.zoom = params.zoom;
                    } else {
                        data.zoom = 15;
                    }

                    if (parseInt(params.width) > 0) {
                        data.width = params.width;
                    } else {
                        data.width = 800;
                    }

                    if (parseInt(params.height) > 0) {
                        data.height = params.height;
                    } else {
                        data.height = 600;
                    }

                    if (typeof params.center === 'object') {
                        if (parseFloat(params.center.lat) > 0 && parseFloat(params.center.lng)) {
                            data.center = params.center.lat + ',' + parseFloat(params.center.lng);
                        } else {
                            hasError = true;
                            fireEvent('error', {
                                code: 6700,
                                message: CHAT_ERRORS[6700],
                                error: undefined
                            });
                        }
                    } else {
                        hasError = true;
                        fireEvent('error', {
                            code: 6700,
                            message: CHAT_ERRORS[6700],
                            error: undefined
                        });
                    }

                    data.key = mapApiKey;
                }

                var keys = Object.keys(data);

                if (keys.length > 0) {
                    url += '?';

                    for (var i = 0; i < keys.length; i++) {
                        var key = keys[i];
                        url += key + '=' + data[key];
                        if (i < keys.length - 1) {
                            url += '&';
                        }
                    }
                }

                var returnData = {
                    hasError: hasError,
                    cache: false,
                    errorMessage: (hasError) ? CHAT_ERRORS[6700] : '',
                    errorCode: (hasError) ? 6700 : undefined,
                    result: {
                        link: (!hasError) ? url : ''
                    }
                };

                callback && callback(returnData);
            },

            //TODO Change Node Version
            getImageFormUrl = function (url, uniqueId, callback) {
                getImageFromLinkObjects[uniqueId] = new Image();
                getImageFromLinkObjects[uniqueId].setAttribute('crossOrigin', 'anonymous');

                getImageFromLinkObjects[uniqueId].onload = function () {
                    var canvas = document.createElement("canvas");
                    canvas.width = this.width;
                    canvas.height = this.height;
                    var ctx = canvas.getContext("2d");
                    ctx.drawImage(this, 0, 0);
                    var dataURI = canvas.toDataURL("image/jpg");

                    var byteString;
                    if (dataURI.split(',')[0].indexOf('base64') >= 0)
                        byteString = atob(dataURI.split(',')[1]);
                    else
                        byteString = unescape(dataURI.split(',')[1]);

                    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

                    var ia = new Uint8Array(byteString.length);
                    for (var i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }

                    delete getImageFromLinkObjects[uniqueId];
                    return callback(new Blob([ia], {type: mimeString}));
                }

                getImageFromLinkObjects[uniqueId].src = url;
            },

            /*
             * Call Functionalities
             */
            startCallWebRTCFunctions = function (params, callback) {
                if (callDivId) {
                    var callParentDiv,
                        callVideo = (typeof params.video === 'boolean') ? params.video : true,
                        callMute = (typeof params.mute === 'boolean') ? params.mute : false,
                        sendingTopic = params.sendingTopic,
                        receiveTopic = params.receiveTopic;

                    callTopics['sendVideoTopic'] = 'Vi-' + sendingTopic;
                    callTopics['sendAudioTopic'] = 'Vo-' + sendingTopic;
                    callTopics['receiveVideoTopic'] = 'Vi-' + receiveTopic;
                    callTopics['receiveAudioTopic'] = 'Vo-' + receiveTopic;

                    callParentDiv = document.getElementById(callDivId);

                    // Local Video Tag
                    if (callVideo && !uiRemoteMedias[callTopics['sendVideoTopic']]) {
                        uiRemoteMedias[callTopics['sendVideoTopic']] = document.createElement('video');
                        uiRemoteMedias[callTopics['sendVideoTopic']].setAttribute('id', 'uiRemoteVideo-' + callTopics['sendVideoTopic']);
                        uiRemoteMedias[callTopics['sendVideoTopic']].setAttribute('class', callVideoTagClassName);
                        uiRemoteMedias[callTopics['sendVideoTopic']].setAttribute('playsinline', '');
                        uiRemoteMedias[callTopics['sendVideoTopic']].setAttribute('muted', '');
                        uiRemoteMedias[callTopics['sendVideoTopic']].setAttribute('width', callVideoMinWidth + 'px');
                        uiRemoteMedias[callTopics['sendVideoTopic']].setAttribute('height', callVideoMinHeight + 'px');
                    }

                    // Local Audio Tag
                    if (!uiRemoteMedias[callTopics['sendAudioTopic']]) {
                        uiRemoteMedias[callTopics['sendAudioTopic']] = document.createElement('audio');
                        uiRemoteMedias[callTopics['sendAudioTopic']].setAttribute('id', 'uiRemoteAudio-' + callTopics['sendAudioTopic']);
                        uiRemoteMedias[callTopics['sendAudioTopic']].setAttribute('class', callAudioTagClassName);
                        uiRemoteMedias[callTopics['sendAudioTopic']].setAttribute('autoplay', '');
                        uiRemoteMedias[callTopics['sendAudioTopic']].setAttribute('muted', '');
                        uiRemoteMedias[callTopics['sendAudioTopic']].setAttribute('controls', '');
                    }

                    // Remote Video Tag
                    if (callVideo && !uiRemoteMedias[callTopics['receiveVideoTopic']]) {
                        uiRemoteMedias[callTopics['receiveVideoTopic']] = document.createElement('video');
                        uiRemoteMedias[callTopics['receiveVideoTopic']].setAttribute('id', 'uiRemoteVideo-' + callTopics['receiveVideoTopic']);
                        uiRemoteMedias[callTopics['receiveVideoTopic']].setAttribute('class', callVideoTagClassName);
                        uiRemoteMedias[callTopics['receiveVideoTopic']].setAttribute('playsinline', '');
                        uiRemoteMedias[callTopics['receiveVideoTopic']].setAttribute('muted', '');
                        uiRemoteMedias[callTopics['receiveVideoTopic']].setAttribute('width', callVideoMinWidth + 'px');
                        uiRemoteMedias[callTopics['receiveVideoTopic']].setAttribute('height', callVideoMinHeight + 'px');
                    }

                    // Remote Audio Tag
                    if (!uiRemoteMedias[callTopics['receiveAudioTopic']]) {
                        uiRemoteMedias[callTopics['receiveAudioTopic']] = document.createElement('audio');
                        uiRemoteMedias[callTopics['receiveAudioTopic']].setAttribute('id', 'uiRemoteAudio-' + callTopics['receiveAudioTopic']);
                        uiRemoteMedias[callTopics['receiveAudioTopic']].setAttribute('class', callAudioTagClassName);
                        uiRemoteMedias[callTopics['receiveAudioTopic']].setAttribute('autoplay', '');
                        callMute && uiRemoteMedias[callTopics['receiveAudioTopic']].setAttribute('muted', '');
                        uiRemoteMedias[callTopics['receiveAudioTopic']].setAttribute('controls', '');
                    }

                    if (callParentDiv) {
                        callVideo && callParentDiv.appendChild(uiRemoteMedias[callTopics['sendVideoTopic']]);
                        callParentDiv.appendChild(uiRemoteMedias[callTopics['sendAudioTopic']]);
                        callVideo && callParentDiv.appendChild(uiRemoteMedias[callTopics['receiveVideoTopic']]);
                        callParentDiv.appendChild(uiRemoteMedias[callTopics['receiveAudioTopic']]);

                        callback && callback({
                            'uiLocalVideo': uiRemoteMedias[callTopics['sendVideoTopic']],
                            'uiLocalAudio': uiRemoteMedias[callTopics['sendAudioTopic']],
                            'uiRemoteVideo': uiRemoteMedias[callTopics['receiveVideoTopic']],
                            'uiRemoteAudio': uiRemoteMedias[callTopics['receiveAudioTopic']]
                        });
                    } else {
                        callback && callback({
                            'uiLocalVideo': uiRemoteMedias[callTopics['sendVideoTopic']],
                            'uiLocalAudio': uiRemoteMedias[callTopics['sendAudioTopic']],
                            'uiRemoteVideo': uiRemoteMedias[callTopics['receiveVideoTopic']],
                            'uiRemoteAudio': uiRemoteMedias[callTopics['receiveAudioTopic']]
                        });
                    }

                    sendCallMessage({
                        id: 'STOPALL'
                    }, function (result) {
                        handleCallSocketOpen({
                            brokerAddress: params.brokerAddress,
                            turnAddress: params.turnAddress,
                            callVideo: callVideo,
                            callAudio: !callMute
                        });
                    });
                } else {
                    consoleLogging && console.log('No Call DIV has been declared!');
                    return;
                }
            },

            handleCallSocketOpen = function (params) {
                currentCallParams = params;

                sendCallMessage({
                    id: 'CREATE_SESSION',
                    brokerAddress: params.brokerAddress,
                    turnAddress: params.turnAddress.split(',')[0]
                }, function (res) {
                    if (res.done === 'TRUE') {
                        generateAndSendSdpOffers(params);
                    } else if (res.done === 'SKIP') {
                        generateAndSendSdpOffers(params);
                    } else {
                        consoleLogging && console.log('CREATE_SESSION faced a problem', res);
                        endCall({
                            callId: currentCallId
                        });
                    }
                });
            },

            shouldReconnectCall = function () {
                if (currentCallParams && Object.keys(currentCallParams).length) {
                    for (var peer in webpeers) {
                        if (webpeers[peer]) {
                            if (webpeers[peer].peerConnection.iceConnectionState != 'connected') {
                                fireEvent('callEvents', {
                                    type: 'CALL_STATUS',
                                    errorCode: 7000,
                                    errorMessage: `Call Peer (${peer}) is not in connected state, Restarting call in progress ...!`,
                                    errorInfo: webpeers[peer]
                                });

                                sendCallMessage({
                                    id: 'STOPALL'
                                }, function (result) {
                                    if (result.done === 'TRUE') {
                                        handleCallSocketOpen(currentCallParams);
                                    } else if (result.done === 'SKIP') {
                                        handleCallSocketOpen(currentCallParams);
                                    } else {
                                        consoleLogging && console.log('STOPALL faced a problem', result);
                                        endCall({
                                            callId: currentCallId
                                        });
                                        callStop();
                                    }
                                });

                                break;
                            }
                        }
                    }
                }
            },

            generateAndSendSdpOffers = function (params) {
                var turnServers = [];

                if (!!params.turnAddress && params.turnAddress.length > 0) {
                    var serversTemp = params.turnAddress.split(',');

                    turnServers = [
                        {"urls": "stun:" + serversTemp[0]},
                        {
                            "urls": "turn:" + serversTemp[1],
                            "username": "mkhorrami",
                            "credential": "mkh_123456"
                        }
                    ];
                } else {
                    turnServers = [
                        {"urls": "stun:" + callTurnIp + ":3478"},
                        {
                            "urls": "turn:" + callTurnIp + ":3478",
                            "username": "mkhorrami",
                            "credential": "mkh_123456"
                        }
                    ];
                }

                // Video Topics
                if (params.callVideo) {

                    const sendVideoOptions = {
                        localVideo: uiRemoteMedias[callTopics['sendVideoTopic']],
                        mediaConstraints: {
                            audio: false,
                            video: {
                                width: callVideoMinWidth,
                                height: callVideoMinHeight,
                                framerate: 15
                            }
                        },
                        onicecandidate: (candidate) => {
                            setTimeout(function () {
                                sendCallMessage({
                                    id: 'ADD_ICE_CANDIDATE',
                                    topic: callTopics['sendVideoTopic'],
                                    candidateDto: candidate
                                })
                            }, 500, {candidate: candidate});
                        },
                        configuration: {
                            iceServers: turnServers
                        }
                    };

                    const receiveVideoOptions = {
                        remoteVideo: uiRemoteMedias[callTopics['receiveVideoTopic']],
                        mediaConstraints: {audio: false, video: true},
                        onicecandidate: (candidate) => {
                            setTimeout(function () {
                                sendCallMessage({
                                    id: 'ADD_ICE_CANDIDATE',
                                    topic: callTopics['receiveVideoTopic'],
                                    candidateDto: candidate
                                })
                            }, 500, {candidate: candidate});
                        },
                        configuration: {
                            iceServers: turnServers
                        }
                    };

                    webpeers[callTopics['receiveVideoTopic']] = new KurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(receiveVideoOptions, function (err) {
                        if (err) {
                            console.error("[start/webRtcReceiveVideoPeer] Error: " + explainUserMediaError(err));
                            return;
                        }

                        webpeers[callTopics['receiveVideoTopic']].generateOffer((err, sdpOffer) => {
                            if (err) {
                                console.error("[start/WebRtcVideoPeerReceiveOnly/generateOffer] " + err);
                                return;
                            }

                            sendCallMessage({
                                id: 'RECIVE_SDP_OFFER',
                                sdpOffer: sdpOffer,
                                useComedia: true,
                                useSrtp: false,
                                topic: callTopics['receiveVideoTopic'],
                                mediaType: 2
                            });
                        });
                    });

                    setTimeout(function () {
                        webpeers[callTopics['sendVideoTopic']] = new KurentoUtils.WebRtcPeer.WebRtcPeerSendonly(sendVideoOptions, function (err) {
                            if (err) {
                                sendCallSocketError("[start/WebRtcVideoPeerSendOnly] Error: " + explainUserMediaError(err));
                                callStop();
                                return;
                            }

                            startMedia(uiRemoteMedias[callTopics['sendVideoTopic']]);

                            webpeers[callTopics['sendVideoTopic']].generateOffer((err, sdpOffer) => {
                                if (err) {
                                    sendCallSocketError("[start/WebRtcVideoPeerSendOnly/generateOffer] Error: " + err);
                                    callStop();
                                    return;
                                }

                                sendCallMessage({
                                    id: 'SEND_SDP_OFFER',
                                    topic: callTopics['sendVideoTopic'],
                                    sdpOffer: sdpOffer,
                                    mediaType: 2
                                });
                            });
                        });
                    }, 2000);
                }

                // Audio Topics
                if (params.callAudio) {
                    const sendAudioOptions = {
                        localVideo: uiRemoteMedias[callTopics['sendAudioTopic']],
                        mediaConstraints: {audio: true, video: false},
                        onicecandidate: (candidate) => {
                            setTimeout(function () {
                                sendCallMessage({
                                    id: 'ADD_ICE_CANDIDATE',
                                    topic: callTopics['sendAudioTopic'],
                                    candidateDto: candidate,
                                })
                            }, 500, {candidate: candidate});
                        },
                        configuration: {
                            iceServers: turnServers
                        }
                    };

                    const receiveAudioOptions = {
                        remoteVideo: uiRemoteMedias[callTopics['receiveAudioTopic']],
                        mediaConstraints: {audio: true, video: false},
                        onicecandidate: (candidate) => {
                            setTimeout(function () {
                                sendCallMessage({
                                    id: 'ADD_ICE_CANDIDATE',
                                    topic: callTopics['receiveAudioTopic'],
                                    candidateDto: candidate,
                                })
                            }, 500, {candidate: candidate});
                        },
                        configuration: {
                            iceServers: turnServers
                        }
                    };

                    webpeers[callTopics['receiveAudioTopic']] = new KurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(receiveAudioOptions, function (err) {
                        if (err) {
                            console.error("[start/WebRtcAudioPeerReceiveOnly] Error: " + explainUserMediaError(err));
                            return;
                        }

                        webpeers[callTopics['receiveAudioTopic']].generateOffer((err, sdpOffer) => {
                            if (err) {
                                console.error("[start/WebRtcAudioPeerReceiveOnly/generateOffer] " + err);
                                return;
                            }
                            sendCallMessage({
                                id: 'RECIVE_SDP_OFFER',
                                sdpOffer: sdpOffer,
                                useComedia: false,
                                useSrtp: false,
                                mediaType: 1,
                                topic: callTopics['receiveAudioTopic']
                            });
                        });
                    });

                    setTimeout(function () {
                        webpeers[callTopics['sendAudioTopic']] = new KurentoUtils.WebRtcPeer.WebRtcPeerSendonly(sendAudioOptions, function (err) {
                            if (err) {
                                sendCallSocketError("[start/WebRtcAudioPeerSendOnly] Error: " + explainUserMediaError(err));
                                callStop();
                                return;
                            }

                            startMedia(uiRemoteMedias[callTopics['sendAudioTopic']]);

                            webpeers[callTopics['sendAudioTopic']].generateOffer((err, sdpOffer) => {
                                if (err) {
                                    sendCallSocketError("[start/WebRtcAudioPeerSendOnly/generateOffer] Error: " + err);
                                    callStop();
                                    return;
                                }
                                sendCallMessage({
                                    id: 'SEND_SDP_OFFER',
                                    topic: callTopics['sendAudioTopic'],
                                    sdpOffer: sdpOffer,
                                    mediaType: 1
                                });
                            });
                        });
                    }, 2000);
                }

                setTimeout(function () {
                    for (var peer in webpeers) {
                        if (webpeers[peer]) {
                            webpeers[peer].peerConnection.oniceconnectionstatechange = function () {
                                if (webpeers[peer].peerConnection.iceConnectionState == 'disconnected') {
                                    fireEvent('callEvents', {
                                        type: 'CALL_STATUS',
                                        errorCode: 7000,
                                        errorMessage: `Call Peer (${peer}) is disconnected!`,
                                        errorInfo: webpeers[peer]
                                    });

                                    setTimeout(function () {
                                        restartMedia(callTopics['sendVideoTopic'])
                                    }, 2000);

                                    setTimeout(function () {
                                        restartMedia(callTopics['sendVideoTopic'])
                                    }, 6000);

                                    shouldReconnectCallTimeout && clearTimeout(shouldReconnectCallTimeout);
                                    shouldReconnectCallTimeout = setTimeout(function () {
                                        shouldReconnectCall();
                                    }, 7000);
                                }

                                if (webpeers[peer].peerConnection.iceConnectionState === "failed") {
                                    fireEvent('callEvents', {
                                        type: 'CALL_STATUS',
                                        errorCode: 7000,
                                        errorMessage: `Call Peer (${peer}) has failed!`,
                                        errorInfo: webpeers[peer]
                                    });
                                }

                                if (webpeers[peer].peerConnection.iceConnectionState === "connected") {
                                    fireEvent('callEvents', {
                                        type: 'CALL_STATUS',
                                        errorCode: 7000,
                                        errorMessage: `Call Peer (${peer}) has connected!`,
                                        errorInfo: webpeers[peer]
                                    });

                                    setTimeout(function () {
                                        restartMedia(callTopics['sendVideoTopic'])
                                    }, 2000);

                                    setTimeout(function () {
                                        restartMedia(callTopics['sendVideoTopic'])
                                    }, 6000);
                                }
                            }
                        }
                    }
                }, 4000);

                setTimeout(function () {
                    restartMedia(callTopics['sendVideoTopic'])
                }, 4000);
                setTimeout(function () {
                    restartMedia(callTopics['sendVideoTopic'])
                }, 8000);
                setTimeout(function () {
                    restartMedia(callTopics['sendVideoTopic'])
                }, 12000);
                setTimeout(function () {
                    restartMedia(callTopics['sendVideoTopic'])
                }, 20000);
            },

            sendCallSocketError = function (message) {
                fireEvent('callEvents', {
                    type: 'CALL_ERROR',
                    code: 7000,
                    message: message
                });

                sendCallMessage({
                    id: 'ERROR',
                    message: message,
                });
            },

            explainUserMediaError = function (err) {
                fireEvent('callEvents', {
                    type: 'CALL_ERROR',
                    code: 7000,
                    message: err
                });

                const n = err.name;
                if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
                    fireEvent('callEvents', {
                        type: 'CALL_ERROR',
                        code: 7000,
                        message: "Missing webcam for required tracks"
                    });
                    return "Missing webcam for required tracks";
                } else if (n === 'NotReadableError' || n === 'TrackStartError') {
                    fireEvent('callEvents', {
                        type: 'CALL_ERROR',
                        code: 7000,
                        message: "Webcam is already in use"
                    });
                    return "Webcam is already in use";
                } else if (n === 'OverconstrainedError' || n === 'ConstraintNotSatisfiedError') {
                    fireEvent('callEvents', {
                        type: 'CALL_ERROR',
                        code: 7000,
                        message: "Webcam doesn't provide required tracks"
                    });
                    return "Webcam doesn't provide required tracks";
                } else if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
                    fireEvent('callEvents', {
                        type: 'CALL_ERROR',
                        code: 7000,
                        message: "Webcam permission has been denied by the user"
                    });
                    return "Webcam permission has been denied by the user";
                } else if (n === 'TypeError') {
                    fireEvent('callEvents', {
                        type: 'CALL_ERROR',
                        code: 7000,
                        message: "No media tracks have been requested"
                    });
                    return "No media tracks have been requested";
                } else {
                    fireEvent('callEvents', {
                        type: 'CALL_ERROR',
                        code: 7000,
                        message: "Unknown error: " + err
                    });
                    return "Unknown error: " + err;
                }
            },

            setCallServerName = function (serverName) {
                if (!!serverName) {
                    callServerName = serverName;
                }
            },

            startMedia = function (media) {
                media.play().catch((err) => {
                    if (err.name === 'NotAllowedError') {
                        fireEvent('callEvents', {
                            type: 'CALL_ERROR',
                            code: 7000,
                            message: "[start] Browser doesn't allow playing media: " + err
                        });
                    } else {
                        fireEvent('callEvents', {
                            type: 'CALL_ERROR',
                            code: 7000,
                            message: "[start] Error in media.play(): " + err
                        });
                    }
                });
            },

            restartMedia = function (videoTopicParam) {
                if (currentCallParams && Object.keys(currentCallParams).length) {
                    consoleLogging && console.log('Sending Key Frame ...');

                    var videoTopic = !!videoTopicParam ? videoTopicParam : callTopics['sendVideoTopic'];
                    let videoElement = document.getElementById(`uiRemoteVideo-${videoTopic}`);

                    if (videoElement) {
                        let videoTrack = videoElement.srcObject.getTracks()[0];

                        if (navigator && !!navigator.userAgent.match(/firefox/gi)) {
                            videoTrack.enable = false;
                            let newWidth = callVideoMinWidth - (Math.ceil(Math.random() * 50) + 20);
                            let newHeight = callVideoMinHeight - (Math.ceil(Math.random() * 50) + 20);

                            videoTrack.applyConstraints({
                                width: {
                                    min: newWidth,
                                    ideal: 1280
                                },
                                height: {
                                    min: newHeight,
                                    ideal: 720
                                },
                                advanced: [
                                    {
                                        width: newWidth,
                                        height: newHeight
                                    },
                                    {
                                        aspectRatio: 1.333
                                    }
                                ]
                            }).then((res) => {
                                videoTrack.enabled = true;
                                setTimeout(() => {
                                    videoTrack.applyConstraints({
                                        "width": callVideoMinWidth,
                                        "height": callVideoMinHeight
                                    });
                                }, 500);
                            }).catch(e => consoleLogging && console.log(e));
                        } else {
                            videoTrack.applyConstraints({
                                "width": callVideoMinWidth - (Math.ceil(Math.random() * 5) + 5)
                            }).then((res) => {
                                setTimeout(function () {
                                    videoTrack.applyConstraints({
                                        "width": callVideoMinWidth
                                    });
                                }, 500);
                            }).catch(e => consoleLogging && console.log(e));
                        }
                    }
                }
            },

            handleProcessSdpAnswer = function (jsonMessage) {
                let sampleWebRtc = webpeers[jsonMessage.topic];

                if (sampleWebRtc == null) {
                    fireEvent('callEvents', {
                        type: 'CALL_ERROR',
                        code: 7000,
                        message: "[handleProcessSdpAnswer] Skip, no WebRTC Peer",
                        error: webpeers[jsonMessage.topic]
                    });
                    return;
                }

                sampleWebRtc.processAnswer(jsonMessage.sdpAnswer, (err) => {
                    if (err) {
                        sendCallSocketError("[handleProcessSdpAnswer] Error: " + err);

                        fireEvent('callEvents', {
                            type: 'CALL_ERROR',
                            code: 7000,
                            message: "[handleProcessSdpAnswer] Error: " + err
                        });

                        return;
                    }
                    startMedia(uiRemoteMedias[jsonMessage.topic]);
                });
            },

            handleAddIceCandidate = function (jsonMessage) {
                let sampleWebRtc = webpeers[jsonMessage.topic];
                if (sampleWebRtc == null) {
                    fireEvent('callEvents', {
                        type: 'CALL_ERROR',
                        code: 7000,
                        message: "[handleAddIceCandidate] Skip, no WebRTC Peer",
                        error: JSON.stringify(webpeers[jsonMessage.topic])
                    });
                    return;
                }

                sampleWebRtc.addIceCandidate(jsonMessage.candidate, (err) => {
                    if (err) {
                        console.error("[handleAddIceCandidate] " + err);

                        fireEvent('callEvents', {
                            type: 'CALL_ERROR',
                            code: 7000,
                            message: "[handleAddIceCandidate] " + err,
                            error: JSON.stringify(jsonMessage.candidate)
                        });

                        return;
                    }
                });
            },

            handlePartnerFreeze = function (jsonMessage) {
                if (!!jsonMessage && !!jsonMessage.topic && jsonMessage.topic.substring(0, 2) === 'Vi') {
                    restartMedia(jsonMessage.topic);
                    setTimeout(function () {
                        restartMedia(jsonMessage.topic)
                    }, 4000);
                    setTimeout(function () {
                        restartMedia(jsonMessage.topic)
                    }, 8000);
                }
            },

            handleError = function (jsonMessage, sendingTopic, receiveTopic) {
                const errMessage = jsonMessage.message;

                fireEvent('callEvents', {
                    type: 'CALL_ERROR',
                    code: 7000,
                    essage: "Kurento error: " + errMessage
                });
            },

            callStop = function () {
                consoleLogging && console.log('Call is stopping ...');

                for (var media in uiRemoteMedias) {
                    removeStreamFromWebRTC(media);
                }

                for (var i in webpeers) {
                    if (webpeers[i]) {
                        webpeers[i].dispose();
                        webpeers[i] = null;
                    }
                }

                sendCallMessage({
                    id: 'CLOSE'
                });

                currentCallParams = {};
                currentCallId = null;
            },

            removeStreamFromWebRTC = function (RTCStream) {
                var callParentDiv = document.getElementById(callDivId);

                if (uiRemoteMedias.hasOwnProperty(RTCStream)) {
                    const stream = uiRemoteMedias[RTCStream].srcObject;
                    if (!!stream) {
                        const tracks = stream.getTracks();

                        if (!!tracks) {
                            tracks.forEach(function (track) {
                                track.stop();
                            });
                        }

                        uiRemoteMedias[RTCStream].srcObject = null;
                    }

                    uiRemoteMedias[RTCStream].remove();
                    delete (uiRemoteMedias[RTCStream]);
                }
            },

            removeFromCallUI = function (topic) {
                var videoElement = 'Vi-' + topic;
                var audioElement = 'Vo-' + topic;

                if (topic.length > 0 && uiRemoteMedias.hasOwnProperty(videoElement)) {
                    removeStreamFromWebRTC(videoElement);
                }

                if (topic.length > 0 && uiRemoteMedias.hasOwnProperty(audioElement)) {
                    removeStreamFromWebRTC(audioElement);
                }
            };

        /******************************************************
         *             P U B L I C   M E T H O D S            *
         ******************************************************/

        this.on = function (eventName, callback) {
            if (eventCallbacks[eventName]) {
                var id = Utility.generateUUID();
                eventCallbacks[eventName][id] = callback;
                return id;
            }
        };

        this.off = function (eventName, eventId) {
            if (eventCallbacks[eventName]) {
                if (eventCallbacks[eventName].hasOwnProperty(eventId)) {
                    delete eventCallbacks[eventName][eventId];
                    return eventId;
                }
            }
        }

        this.getPeerId = function () {
            return peerId;
        };

        this.getCurrentUser = function () {
            return userInfo;
        };

        this.getUserInfo = function (callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.USER_INFO,
                typeCode: generalTypeCode
            }, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {

                        var messageContent = result.result;
                        var currentUser = formatDataToMakeUser(messageContent);

                        returnData.result = {
                            user: currentUser
                        };

                        callback && callback(returnData);
                    }
                }
            });
        };

        this.getThreads = getThreads;

        this.getAllThreads = getAllThreads;

        this.getHistory = getHistory;

        this.getAllMentionedMessages = function (params, callback) {
            return getHistory({
                threadId: params.threadId,
                allMentioned: true,
                typeCode: params.typeCode,
                count: params.count || 50,
                offset: params.offset || 0,
                cache: false,
                queues: {
                    uploading: false,
                    sending: false
                }
            }, callback);
        };

        this.getUnreadMentionedMessages = function (params, callback) {
            return getHistory({
                threadId: params.threadId,
                unreadMentioned: true,
                typeCode: params.typeCode,
                count: params.count || 50,
                offset: params.offset || 0,
                cache: false,
                queues: {
                    uploading: false,
                    sending: false
                }
            }, callback);
        };

        this.getAllUnreadMessagesCount = function (params, callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.ALL_UNREAD_MESSAGE_COUNT,
                typeCode: params.typeCode,
                content: JSON.stringify({
                    'mute': (typeof params.countMuteThreads === 'boolean') ? params.countMuteThreads : false
                }),
                pushMsgType: 3,
                token: token
            }, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        /**
         * Get Contacts
         *
         * Gets contacts list from chat server
         *
         * @access pubic
         *
         * @param {int}     count           Count of objects to get
         * @param {int}     offset          Offset of select Query
         * @param {string}  query           Search in contacts list to get (search LIKE firstName, lastName, email)
         *
         * @return {object} Instant Response
         */
        this.getContacts = function (params, callback) {
            var count = 50,
                offset = 0,
                content = {},
                whereClause = {},
                returnCache = false;

            if (params) {
                if (parseInt(params.count) > 0) {
                    count = parseInt(params.count);
                }
                if (parseInt(params.offset) > 0) {
                    offset = parseInt(params.offset);
                }
                if (typeof params.query === 'string') {
                    content.query = whereClause.query = params.query;
                }
                if (typeof params.email === 'string') {
                    content.email = whereClause.email = params.email;
                }
                if (typeof params.cellphoneNumber === 'string') {
                    content.cellphoneNumber = whereClause.cellphoneNumber = params.cellphoneNumber;
                }
                if (parseInt(params.contactId) > 0) {
                    content.id = whereClause.id = params.contactId;
                }
                if (typeof params.uniqueId === 'string') {
                    content.uniqueId = whereClause.uniqueId = params.uniqueId;
                }
                if (typeof params.username === 'string') {
                    content.username = params.username;
                }

                var functionLevelCache = (typeof params.cache == 'boolean') ? params.cache : true;
            }

            content.size = count;
            content.offset = offset;

            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.GET_CONTACTS,
                typeCode: params.typeCode,
                content: content
            };

            /**
             * Retrieve contacts from cache #cache
             */
            if (functionLevelCache && canUseCache && cacheSecret.length > 0) {
                if (db) {

                    /**
                     * First of all we delete all contacts those
                     * expireTime has been expired. after that
                     * we query our cache database to retrieve
                     * what we wanted
                     */
                    db.contacts.where('expireTime')
                        .below(new Date().getTime())
                        .delete()
                        .then(function () {

                            /**
                             * Query cache database to get contacts
                             */
                            var thenAble;

                            if (Object.keys(whereClause).length === 0) {
                                thenAble = db.contacts.where('owner')
                                    .equals(parseInt(userInfo.id));
                            } else {
                                if (whereClause.hasOwnProperty('query')) {
                                    thenAble = db.contacts.where('owner')
                                        .equals(parseInt(userInfo.id))
                                        .filter(function (contact) {
                                            var reg = new RegExp(whereClause.query);
                                            return reg.test(chatDecrypt(contact.firstName, cacheSecret, contact.salt) + ' '
                                                + chatDecrypt(contact.lastName, cacheSecret, contact.salt) + ' '
                                                + chatDecrypt(contact.email, cacheSecret, contact.salt));
                                        });
                                }
                            }

                            thenAble.reverse()
                                .offset(offset)
                                .limit(count)
                                .toArray()
                                .then(function (contacts) {
                                    db.contacts.where('owner')
                                        .equals(parseInt(userInfo.id))
                                        .count()
                                        .then(function (contactsCount) {
                                            var cacheData = [];

                                            for (var i = 0; i < contacts.length; i++) {
                                                try {
                                                    cacheData.push(formatDataToMakeContact(JSON.parse(chatDecrypt(contacts[i].data, cacheSecret, contacts[i].salt))));
                                                } catch (error) {
                                                    fireEvent('error', {
                                                        code: error.code,
                                                        message: error.message,
                                                        error: error
                                                    });
                                                }
                                            }

                                            var returnData = {
                                                hasError: false,
                                                cache: true,
                                                errorCode: 0,
                                                errorMessage: '',
                                                result: {
                                                    contacts: cacheData,
                                                    contentCount: contactsCount,
                                                    hasNext: !(contacts.length < count),
                                                    nextOffset: offset * 1 + contacts.length
                                                }
                                            };

                                            if (cacheData.length > 0) {
                                                callback && callback(returnData);
                                                callback = undefined;
                                                returnCache = true;
                                            }
                                        });
                                })
                                .catch(function (error) {
                                    fireEvent('error', {
                                        code: error.code,
                                        message: error.message,
                                        error: error
                                    });
                                });
                        })
                        .catch(function (error) {
                            fireEvent('error', {
                                code: error.code,
                                message: error.message,
                                error: error
                            });
                        });
                } else {
                    fireEvent('error', {
                        code: 6601,
                        message: CHAT_ERRORS[6601],
                        error: null
                    });
                }
            }

            /**
             * Retrieve Contacts from server
             */
            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {

                        var messageContent = result.result,
                            messageLength = messageContent.length,
                            resultData = {
                                contacts: [],
                                contentCount: result.contentCount,
                                hasNext: (offset + count < result.contentCount && messageLength > 0),
                                nextOffset: offset * 1 + messageLength * 1
                            },
                            contactData;

                        for (var i = 0; i < messageLength; i++) {
                            contactData = formatDataToMakeContact(messageContent[i]);
                            if (contactData) {
                                resultData.contacts.push(contactData);
                            }
                        }

                        returnData.result = resultData;

                        /**
                         * Add Contacts into cache database #cache
                         */
                        if (canUseCache && cacheSecret.length > 0) {
                            if (db) {
                                var cacheData = [];

                                for (var i = 0; i < resultData.contacts.length; i++) {
                                    try {
                                        var tempData = {},
                                            salt = Utility.generateUUID();
                                        tempData.id = resultData.contacts[i].id;
                                        tempData.owner = userInfo.id;
                                        tempData.uniqueId = resultData.contacts[i].uniqueId;
                                        tempData.userId = Utility.crypt(resultData.contacts[i].userId, cacheSecret, salt);
                                        tempData.cellphoneNumber = Utility.crypt(resultData.contacts[i].cellphoneNumber, cacheSecret, salt);
                                        tempData.email = Utility.crypt(resultData.contacts[i].email, cacheSecret, salt);
                                        tempData.firstName = Utility.crypt(resultData.contacts[i].firstName, cacheSecret, salt);
                                        tempData.lastName = Utility.crypt(resultData.contacts[i].lastName, cacheSecret, salt);
                                        tempData.expireTime = new Date().getTime() + cacheExpireTime;
                                        tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(resultData.contacts[i])), cacheSecret, salt);
                                        tempData.salt = salt;

                                        cacheData.push(tempData);
                                    } catch (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    }
                                }

                                db.contacts.bulkPut(cacheData)
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }
                    }

                    callback && callback(returnData);
                    /**
                     * Delete callback so if server pushes response before
                     * cache, cache won't send data again
                     */
                    callback = undefined;

                    if (!returnData.hasError && returnCache) {
                        fireEvent('contactEvents', {
                            type: 'CONTACTS_LIST_CHANGE',
                            result: returnData.result
                        });
                    }
                }
            });
        };

        this.getThreadParticipants = getThreadParticipants;

        /**
         * Get Thread Admins
         *
         * Gets admins list of given thread
         *
         * @access pubic
         *
         * @param {int}     threadId        Id of thread which you want to get admins of
         *
         * @return {object} Instant Response
         */
        this.getThreadAdmins = function (params, callback) {
            getThreadParticipants({
                threadId: params.threadId,
                admin: true,
                cache: false
            }, callback);
        };

        this.addParticipants = function (params, callback) {
            /**
             * + AddParticipantsRequest   {object}
             *    - subjectId             {int}
             *    + content               {list} List of CONTACT IDs or inviteeVO Objects
             *    - uniqueId              {string}
             */
            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.ADD_PARTICIPANT,
                typeCode: params.typeCode,
                content: []
            };
            if (params) {
                if (parseInt(params.threadId) > 0) {
                    sendMessageParams.subjectId = params.threadId;
                }

                if (Array.isArray(params.contactIds)) {
                    sendMessageParams.content = params.contactIds;
                }

                if (Array.isArray(params.usernames)) {
                    sendMessageParams.content = [];
                    for (var i = 0; i < params.usernames.length; i++) {
                        sendMessageParams.content.push({
                            id: params.usernames[i],
                            idType: inviteeVOidTypes.TO_BE_USER_USERNAME
                        });
                    }
                }

                if (Array.isArray(params.coreUserids)) {
                    sendMessageParams.content = [];
                    for (var i = 0; i < params.coreUserids.length; i++) {
                        sendMessageParams.content.push({
                            id: params.coreUserids[i],
                            idType: inviteeVOidTypes.TO_BE_CORE_USER_ID
                        });
                    }
                }
            }

            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = {
                            thread: createThread(messageContent)
                        };
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.removeParticipants = function (params, callback) {

            /**
             * + RemoveParticipantsRequest    {object}
             *    - subjectId                 {int}
             *    + content                   {list} List of PARTICIPANT IDs from Thread's Participants object
             *       -id                      {int}
             *    - uniqueId                  {string}
             */

            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.REMOVE_PARTICIPANT,
                typeCode: params.typeCode
            };

            if (params) {
                if (parseInt(params.threadId) > 0) {
                    sendMessageParams.subjectId = params.threadId;
                }

                if (Array.isArray(params.participantIds)) {
                    sendMessageParams.content = params.participantIds;
                }
            }

            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        var messageContent = result.result;

                        returnData.result = {
                            thread: createThread(messageContent)
                        };
                    }

                    callback && callback(returnData);
                }
            });
        };

        this.getCurrentUserRoles = getCurrentUserRoles;

        this.leaveThread = function (params, callback) {

            /**
             * + LeaveThreadRequest    {object}
             *    - subjectId          {int}
             *    - uniqueId           {string}
             */

            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.LEAVE_THREAD,
                typeCode: params.typeCode
            };

            if (params) {
                if (parseInt(params.threadId) > 0) {
                    sendMessageParams.subjectId = params.threadId;
                }

                if (typeof params.clearHistory === 'boolean') {
                    sendMessageParams.content = {
                        clearHistory: params.clearHistory
                    };
                } else {
                    sendMessageParams.content = {
                        clearHistory: true
                    };
                }
            }

            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        var messageContent = result.result;

                        returnData.result = {
                            thread: createThread(messageContent)
                        };
                    }

                    callback && callback(returnData);
                }
            });
        };

        this.createThread = function (params, callback) {

            /**
             * + CreateThreadRequest      {object}
             *    + invitees              {object}
             *       -id                  {string}
             *       -idType              {int} ** inviteeVOidTypes
             *    - title                 {string}
             *    - type                  {int} ** createThreadTypes
             *    - image                 {string}
             *    - description           {string}
             *    - metadata              {string}
             *    - uniqueName            {string}
             *    + message               {object}
             *       -text                {string}
             *       -type                {int}
             *       -repliedTo           {int}
             *       -uniqueId            {string}
             *       -metadata            {string}
             *       -systemMetadata      {string}
             *       -forwardedMessageIds {string}
             *       -forwardedUniqueIds  {string}
             */

            var content = {};

            if (params) {
                if (typeof params.title === 'string') {
                    content.title = params.title;
                }

                if (typeof params.type === 'string') {
                    var threadType = params.type;
                    content.type = createThreadTypes[threadType];
                }

                if (typeof params.uniqueName === 'string') {
                    content.uniqueName = params.uniqueName;
                }

                if (Array.isArray(params.invitees)) {
                    content.invitees = [];
                    for (var i = 0; i < params.invitees.length; i++) {
                        var tempInvitee = formatDataToMakeInvitee(params.invitees[i]);
                        if (tempInvitee) {
                            content.invitees.push(tempInvitee);
                        }
                    }
                }

                if (typeof params.image === 'string') {
                    content.image = params.image;
                }

                if (typeof params.description === 'string') {
                    content.description = params.description;
                }

                if (typeof params.metadata === 'string') {
                    content.metadata = params.metadata;
                } else if (typeof params.metadata === 'object') {
                    try {
                        content.metadata = JSON.stringify(params.metadata);
                    } catch (e) {
                        consoleLogging && console.log(e);
                    }
                }

                if (typeof params.message == 'object') {
                    content.message = {};

                    if (typeof params.message.text === 'string') {
                        content.message.text = params.message.text;
                    }

                    if (typeof params.message.uniqueId === 'string') {
                        content.message.uniqueId = params.message.uniqueId;
                    }

                    if (params.message.type > 0) {
                        content.message.messageType = params.message.type;
                    }

                    if (params.message.repliedTo > 0) {
                        content.message.repliedTo = params.message.repliedTo;
                    }

                    if (typeof params.message.metadata === 'string') {
                        content.message.metadata = params.message.metadata;
                    } else if (typeof params.message.metadata === 'object') {
                        content.message.metadata = JSON.stringify(params.message.metadata);
                    }

                    if (typeof params.message.systemMetadata === 'string') {
                        content.message.systemMetadata = params.message.systemMetadata;
                    } else if (typeof params.message.systemMetadata === 'object') {
                        content.message.systemMetadata = JSON.stringify(params.message.systemMetadata);
                    }

                    if (Array.isArray(params.message.forwardedMessageIds)) {
                        content.message.forwardedMessageIds = params.message.forwardedMessageIds;
                        content.message.forwardedUniqueIds = [];
                        for (var i = 0; i < params.message.forwardedMessageIds.length; i++) {
                            content.message.forwardedUniqueIds.push(Utility.generateUUID());
                        }
                    }

                }
            }

            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.CREATE_THREAD,
                typeCode: params.typeCode,
                content: content
            };

            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        var messageContent = result.result;

                        returnData.result = {
                            thread: createThread(messageContent)
                        };
                    }

                    callback && callback(returnData);
                }
            });

        };

        this.createSelfThread = function (params, callback) {
            var content = {
                type: createThreadTypes['SELF']
            };

            if (params) {
                if (typeof params.description === 'string') {
                    content.description = params.description;
                }

                if (typeof params.metadata === 'string') {
                    content.metadata = params.metadata;
                } else if (typeof params.metadata === 'object') {
                    try {
                        content.metadata = JSON.stringify(params.metadata);
                    } catch (e) {
                        consoleLogging && console.log(e);
                    }
                }

                if (typeof params.message == 'object') {
                    content.message = {};

                    if (typeof params.message.text === 'string') {
                        content.message.text = params.message.text;
                    }

                    if (typeof params.message.uniqueId === 'string') {
                        content.message.uniqueId = params.message.uniqueId;
                    }

                    if (params.message.type > 0) {
                        content.message.messageType = params.message.type;
                    }

                    if (params.message.repliedTo > 0) {
                        content.message.repliedTo = params.message.repliedTo;
                    }

                    if (typeof params.message.metadata === 'string') {
                        content.message.metadata = params.message.metadata;
                    } else if (typeof params.message.metadata === 'object') {
                        content.message.metadata = JSON.stringify(params.message.metadata);
                    }

                    if (typeof params.message.systemMetadata === 'string') {
                        content.message.systemMetadata = params.message.systemMetadata;
                    } else if (typeof params.message.systemMetadata === 'object') {
                        content.message.systemMetadata = JSON.stringify(params.message.systemMetadata);
                    }

                    if (Array.isArray(params.message.forwardedMessageIds)) {
                        content.message.forwardedMessageIds = params.message.forwardedMessageIds;
                        content.message.forwardedUniqueIds = [];
                        for (var i = 0; i < params.message.forwardedMessageIds.length; i++) {
                            content.message.forwardedUniqueIds.push(Utility.generateUUID());
                        }
                    }

                }
            }

            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.CREATE_THREAD,
                typeCode: params.typeCode,
                content: content
            };

            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        var messageContent = result.result;

                        returnData.result = {
                            thread: createThread(messageContent)
                        };
                    }

                    callback && callback(returnData);
                }
            });
        };

        this.sendTextMessage = function (params, callbacks) {
            var metadata = {},
                uniqueId;

            if (typeof params.uniqueId !== 'undefined') {
                uniqueId = params.uniqueId;
            } else {
                uniqueId = Utility.generateUUID();
            }

            putInChatSendQueue({
                message: {
                    chatMessageVOType: chatMessageVOTypes.MESSAGE,
                    typeCode: params.typeCode,
                    messageType: (params.messageType && typeof params.messageType.toUpperCase() !== 'undefined' && chatMessageTypes[params.messageType.toUpperCase()] > 0) ? chatMessageTypes[params.messageType.toUpperCase()] : chatMessageTypes.TEXT,
                    subjectId: params.threadId,
                    repliedTo: params.repliedTo,
                    content: params.textMessage,
                    uniqueId: uniqueId,
                    systemMetadata: JSON.stringify(params.systemMetadata),
                    metadata: JSON.stringify(metadata),
                    pushMsgType: 3
                },
                callbacks: callbacks
            }, function () {
                chatSendQueueHandler();
            });

            return {
                uniqueId: uniqueId,
                threadId: params.threadId,
                participant: userInfo,
                content: params.content
            };
        };

        this.sendBotMessage = function (params, callbacks) {
            var metadata = {};

            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.BOT_MESSAGE,
                typeCode: params.typeCode,
                subjectId: params.messageId,
                content: params.content,
                uniqueId: params.uniqueId,
                metadata: metadata,
                pushMsgType: 3
            }, callbacks);
        };

        this.sendFileMessage = sendFileMessage;

        this.createThreadWithFileMessage = function (params, createThreadCallback, sendFileMessageCallback) {
            /**
             * + CreateThreadRequest      {object}
             *    + invitees              {object}
             *       -id                  {string}
             *       -idType              {int} ** inviteeVOidTypes
             *    - title                 {string}
             *    - type                  {int} ** createThreadTypes
             *    - image                 {string}
             *    - description           {string}
             *    - metadata              {string}
             *    - uniqueName            {string}
             *    + message               {object}
             *       -text                {string}
             *       -type                {int}
             *       -repliedTo           {int}
             *       -uniqueId            {string}
             *       -metadata            {string}
             *       -systemMetadata      {string}
             *       -forwardedMessageIds {string}
             *       -forwardedUniqueIds  {string}
             */
            var content = {};
            if (params) {
                if (typeof params.title === 'string') {
                    content.title = params.title;
                }
                if (typeof params.type === 'string') {
                    var threadType = params.type;
                    content.type = createThreadTypes[threadType];
                }
                if (Array.isArray(params.invitees)) {
                    content.invitees = [];
                    for (var i = 0; i < params.invitees.length; i++) {
                        var tempInvitee = formatDataToMakeInvitee(params.invitees[i]);
                        if (tempInvitee) {
                            content.invitees.push(tempInvitee);
                        }
                    }
                }
                if (typeof params.description === 'string') {
                    content.description = params.description;
                }
                if (typeof params.content === 'string') {
                    content.content = params.content;
                }
                if (typeof params.metadata === 'string') {
                    content.metadata = params.metadata;
                } else if (typeof params.metadata === 'object') {
                    try {
                        content.metadata = JSON.stringify(params.metadata);
                    } catch (e) {
                        consoleLogging && console.log(e);
                    }
                }
            }
            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.CREATE_THREAD,
                typeCode: params.typeCode,
                content: content
            };
            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = {
                            thread: createThread(messageContent)
                        };
                    }
                    createThreadCallback && createThreadCallback(returnData);
                    sendFileMessage({
                        threadId: returnData.result.thread.id,
                        file: params.file,
                        content: params.caption,
                        messageType: params.messageType,
                        userGroupHash: returnData.result.thread.userGroupHash
                    }, sendFileMessageCallback);
                }
            });
        };

        this.sendLocationMessage = function (params, callbacks) {
            var data = {},
                url = SERVICE_ADDRESSES.MAP_ADDRESS + SERVICES_PATH.STATIC_IMAGE,
                hasError = false,
                fileUniqueId = Utility.generateUUID();
            if (params) {
                if (typeof params.mapType === 'string') {
                    data.type = params.mapType;
                } else {
                    data.type = 'standard-night';
                }
                if (parseInt(params.mapZoom) > 0) {
                    data.zoom = params.mapZoom;
                } else {
                    data.zoom = 15;
                }
                if (parseInt(params.mapWidth) > 0) {
                    data.width = params.mapWidth;
                } else {
                    data.width = 800;
                }
                if (parseInt(params.mapHeight) > 0) {
                    data.height = params.mapHeight;
                } else {
                    data.height = 600;
                }
                if (typeof params.mapCenter === 'object') {
                    if (parseFloat(params.mapCenter.lat) > 0 && parseFloat(params.mapCenter.lng)) {
                        data.center = params.mapCenter.lat + ',' + parseFloat(params.mapCenter.lng);
                    } else {
                        hasError = true;
                        fireEvent('error', {
                            code: 6700,
                            message: CHAT_ERRORS[6700],
                            error: undefined
                        });
                    }
                } else {
                    hasError = true;
                    fireEvent('error', {
                        code: 6700,
                        message: CHAT_ERRORS[6700],
                        error: undefined
                    });
                }
                data.key = mapApiKey;
                data.marker = 'red';
            }
            var keys = Object.keys(data);
            if (keys.length > 0) {
                url += '?';
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    url += key + '=' + data[key];
                    if (i < keys.length - 1) {
                        url += '&';
                    }
                }
            }
            if (!hasError) {
                mapReverse({
                    lng: parseFloat(params.mapCenter.lng),
                    lat: parseFloat(params.mapCenter.lat)
                }, function (address) {
                    getImageFormUrl(url, fileUniqueId, function (blobImage) {
                        sendFileMessage({
                            threadId: params.threadId,
                            fileUniqueId: fileUniqueId,
                            file: new File([blobImage], "location.png", {type: "image/png", lastModified: new Date()}),
                            content: address.result.formatted_address,
                            messageType: 'POD_SPACE_PICTURE',
                            userGroupHash: params.userGroupHash,
                            metadata: {
                                mapLink: `https://maps.neshan.org/@${data.center},${data.zoom}z`,
                                address: address
                            }
                        }, callbacks);
                    });
                });
            }
            return {
                uniqueId: fileUniqueId,
                threadId: params.threadId,
                participant: userInfo,
                cancel: function () {
                    if (typeof getImageFromLinkObjects !== 'undefined' && getImageFromLinkObjects.hasOwnProperty(fileUniqueId)) {
                        getImageFromLinkObjects[fileUniqueId].onload = function () {
                        };
                        delete getImageFromLinkObjects[fileUniqueId];
                        consoleLogging && console.log(`"${fileUniqueId}" - Downloading Location Map has been canceled!`);
                    }

                    cancelFileUpload({
                        uniqueId: fileUniqueId
                    }, function () {
                        consoleLogging && console.log(`"${fileUniqueId}" - Sending Location Message has been canceled!`);
                    });
                }
            };
        };

        this.resendMessage = function (uniqueId, callbacks) {
            if (hasCache && typeof queueDb == 'object' && !forceWaitQueueInMemory) {
                queueDb.waitQ.where('uniqueId')
                    .equals(uniqueId)
                    .and(function (item) {
                        return item.owner === parseInt(userInfo.id);
                    })
                    .toArray()
                    .then(function (messages) {
                        if (messages.length) {
                            putInChatSendQueue({
                                message: Utility.jsonParser(chatDecrypt(messages[0].message, cacheSecret)),
                                callbacks: callbacks
                            }, function () {
                                chatSendQueueHandler();
                            });
                        }
                    })
                    .catch(function (error) {
                        fireEvent('error', {
                            code: error.code,
                            message: error.message,
                            error: error
                        });
                    });
            } else {
                for (var i = 0; i < chatWaitQueue.length; i++) {
                    if (chatWaitQueue[i].uniqueId === uniqueId) {
                        putInChatSendQueue({
                            message: chatWaitQueue[i],
                            callbacks: callbacks
                        }, function () {
                            chatSendQueueHandler();
                        }, true);
                        // break;
                    }
                }
            }
        };

        this.cancelMessage = cancelMessage;

        this.clearHistory = function (params, callback) {

            /**
             * + Clear History Request Object    {object}
             *    - subjectId                    {int}
             */

            var clearHistoryParams = {
                chatMessageVOType: chatMessageVOTypes.CLEAR_HISTORY,
                typeCode: params.typeCode
            };

            if (params) {
                if (parseInt(params.threadId) > 0) {
                    clearHistoryParams.subjectId = params.threadId;
                }
            }

            return sendMessage(clearHistoryParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        returnData.result = {
                            thread: result.result
                        };

                        /**
                         * Delete all messages of this thread from cache
                         */
                        if (canUseCache) {
                            if (db) {
                                db.messages.where('threadId')
                                    .equals(parseInt(result.result))
                                    .and(function (message) {
                                        return message.owner === userInfo.id;
                                    })
                                    .delete()
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }
                    }

                    callback && callback(returnData);
                }
            });
        };

        this.getImage = getImage;

        this.getFile = getFile;

        this.getFileFromPodspace = getFileFromPodspace;

        this.getImageFromPodspace = getImageFromPodspace;

        this.uploadFile = uploadFile;

        this.uploadImage = uploadImage;

        this.cancelFileUpload = cancelFileUpload;

        this.cancelFileDownload = cancelFileDownload;

        this.editMessage = function (params, callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.EDIT_MESSAGE,
                typeCode: params.typeCode,
                messageType: params.messageType,
                subjectId: params.messageId,
                repliedTo: params.repliedTo,
                content: params.content,
                uniqueId: params.uniqueId,
                metadata: params.metadata,
                systemMetadata: params.systemMetadata,
                pushMsgType: 3
            }, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        var messageContent = result.result,
                            resultData = {
                                editedMessage: formatDataToMakeMessage(undefined, messageContent)
                            };

                        returnData.result = resultData;

                        /**
                         * Update Message on cache
                         */
                        if (canUseCache && cacheSecret.length > 0) {
                            if (db) {
                                try {
                                    var tempData = {},
                                        salt = Utility.generateUUID();
                                    tempData.id = parseInt(resultData.editedMessage.id);
                                    tempData.owner = parseInt(userInfo.id);
                                    tempData.threadId = parseInt(resultData.editedMessage.threadId);
                                    tempData.time = resultData.editedMessage.time;
                                    tempData.message = Utility.crypt(resultData.editedMessage.message, cacheSecret, salt);
                                    tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(resultData.editedMessage)), cacheSecret, salt);
                                    tempData.salt = salt;

                                    /**
                                     * Insert Message into cache database
                                     */
                                    db.messages.put(tempData)
                                        .catch(function (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        });
                                } catch (error) {
                                    fireEvent('error', {
                                        code: error.code,
                                        message: error.message,
                                        error: error
                                    });
                                }
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }
                    }

                    callback && callback(returnData);
                }
            });
        };

        this.deleteMessage = function (params, callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.DELETE_MESSAGE,
                typeCode: params.typeCode,
                subjectId: params.messageId,
                uniqueId: params.uniqueId,
                content: JSON.stringify({
                    'deleteForAll': (typeof params.deleteForAll === 'boolean') ? params.deleteForAll : false
                }),
                pushMsgType: 3
            }, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        returnData.result = {
                            deletedMessage: {
                                id: result.result.id,
                                pinned: result.result.pinned,
                                mentioned: result.result.mentioned,
                                messageType: result.result.messageType,
                                edited: result.result.edited,
                                editable: result.result.editable,
                                deletable: result.result.deletable
                            }
                        };

                        /**
                         * Remove Message from cache
                         */
                        if (canUseCache) {
                            if (db) {
                                db.messages.where('id')
                                    .equals(parseInt(result.result))
                                    .delete()
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: 6602,
                                            message: CHAT_ERRORS[6602],
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                    }

                    callback && callback(returnData);
                }
            });
        };

        this.deleteMultipleMessages = function (params, callback) {
            var messageIdsList = params.messageIds,
                uniqueIdsList = [];

            for (var i in messageIdsList) {
                var uniqueId = Utility.generateUUID();
                uniqueIdsList.push(uniqueId);

                messagesCallbacks[uniqueId] = function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        returnData.result = {
                            deletedMessage: {
                                id: result.result.id,
                                pinned: result.result.pinned,
                                mentioned: result.result.mentioned,
                                messageType: result.result.messageType,
                                edited: result.result.edited,
                                editable: result.result.editable,
                                deletable: result.result.deletable
                            }
                        };

                        /**
                         * Remove Message from cache
                         */
                        if (canUseCache) {
                            if (db) {
                                db.messages.where('id')
                                    .equals(parseInt(result.result))
                                    .delete()
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: 6602,
                                            message: CHAT_ERRORS[6602],
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                    }

                    callback && callback(returnData);
                };
            }

            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.DELETE_MESSAGE,
                typeCode: params.typeCode,
                content: {
                    uniqueIds: uniqueIdsList,
                    ids: messageIdsList,
                    deleteForAll: (typeof params.deleteForAll === 'boolean') ? params.deleteForAll : false
                },
                pushMsgType: 3
            });
        };

        this.replyTextMessage = function (params, callbacks) {
            var uniqueId;

            if (typeof params.uniqueId !== 'undefined') {
                uniqueId = params.uniqueId;
            } else {
                uniqueId = Utility.generateUUID();
            }

            putInChatSendQueue({
                message: {
                    chatMessageVOType: chatMessageVOTypes.MESSAGE,
                    typeCode: params.typeCode,
                    messageType: 1,
                    subjectId: params.threadId,
                    repliedTo: params.repliedTo,
                    content: params.textMessage,
                    uniqueId: uniqueId,
                    systemMetadata: JSON.stringify(params.systemMetadata),
                    metadata: JSON.stringify(params.metadata),
                    pushMsgType: 3
                },
                callbacks: callbacks
            }, function () {
                chatSendQueueHandler();
            });

            return {
                uniqueId: uniqueId,
                threadId: params.threadId,
                participant: userInfo,
                content: params.content
            };
        };

        this.replyFileMessage = function (params, callbacks) {
            var metadata = {file: {}},
                fileUploadParams = {},
                fileUniqueId = Utility.generateUUID();
            if (!params.userGroupHash || params.userGroupHash.length === 0 || typeof (params.userGroupHash) !== 'string') {
                fireEvent('error', {
                    code: 6304,
                    message: CHAT_ERRORS[6304]
                });
                return;
            } else {
                fileUploadParams.userGroupHash = params.userGroupHash;
            }
            return chatUploadHandler({
                threadId: params.threadId,
                file: params.file,
                fileUniqueId: fileUniqueId
            }, function (uploadHandlerResult, uploadHandlerMetadata, fileType, fileExtension) {
                fileUploadParams = Object.assign(fileUploadParams, uploadHandlerResult);
                putInChatUploadQueue({
                    message: {
                        chatMessageVOType: chatMessageVOTypes.MESSAGE,
                        typeCode: params.typeCode,
                        messageType: (params.messageType && typeof params.messageType.toUpperCase() !== 'undefined' && chatMessageTypes[params.messageType.toUpperCase()] > 0) ? chatMessageTypes[params.messageType.toUpperCase()] : 1,
                        subjectId: params.threadId,
                        repliedTo: params.repliedTo,
                        content: params.content,
                        metadata: JSON.stringify(uploadHandlerMetadata),
                        systemMetadata: JSON.stringify(params.systemMetadata),
                        uniqueId: fileUniqueId,
                        pushMsgType: 3
                    },
                    callbacks: callbacks
                }, function () {
                    if (imageMimeTypes.indexOf(fileType) >= 0 || imageExtentions.indexOf(fileExtension) >= 0) {
                        uploadImageToPodspaceUserGroup(fileUploadParams, function (result) {
                            if (!result.hasError) {
                                metadata['name'] = result.result.name;
                                metadata['fileHash'] = result.result.hashCode;
                                metadata['file']['name'] = result.result.name;
                                metadata['file']['fileHash'] = result.result.hashCode;
                                metadata['file']['hashCode'] = result.result.hashCode;
                                metadata['file']['actualHeight'] = result.result.actualHeight;
                                metadata['file']['actualWidth'] = result.result.actualWidth;
                                metadata['file']['parentHash'] = result.result.parentHash;
                                metadata['file']['size'] = result.result.size;
                                metadata['file']['link'] = `https://podspace.pod.ir/nzh/drive/downloadImage?hash=${result.result.hashCode}`;
                                transferFromUploadQToSendQ(parseInt(params.threadId), fileUniqueId, JSON.stringify(metadata), function () {
                                    chatSendQueueHandler();
                                });
                            } else {
                                deleteFromChatUploadQueue({message: {uniqueId: fileUniqueId}});
                            }
                        });
                    } else {
                        uploadFileToPodspace(fileUploadParams, function (result) {
                            if (!result.hasError) {
                                metadata['fileHash'] = result.result.hashCode;
                                metadata['name'] = result.result.name;
                                metadata['file']['name'] = result.result.name;
                                metadata['file']['fileHash'] = result.result.hashCode;
                                metadata['file']['hashCode'] = result.result.hashCode;
                                metadata['file']['parentHash'] = result.result.parentHash;
                                metadata['file']['size'] = result.result.size;
                                transferFromUploadQToSendQ(parseInt(params.threadId), fileUniqueId, JSON.stringify(metadata), function () {
                                    chatSendQueueHandler();
                                });
                            } else {
                                deleteFromChatUploadQueue({message: {uniqueId: fileUniqueId}});
                            }
                        });
                    }
                });
            });
        };

        this.forwardMessage = function (params, callbacks) {
            var threadId = params.threadId,
                messageIdsList = params.messageIds,
                uniqueIdsList = [];

            for (var i in messageIdsList) {
                if (!threadCallbacks[threadId]) {
                    threadCallbacks[threadId] = {};
                }

                var uniqueId = Utility.generateUUID();
                uniqueIdsList.push(uniqueId);

                threadCallbacks[threadId][uniqueId] = {};

                sendMessageCallbacks[uniqueId] = {};

                if (callbacks.onSent) {
                    sendMessageCallbacks[uniqueId].onSent = callbacks.onSent;
                    threadCallbacks[threadId][uniqueId].onSent = false;
                    threadCallbacks[threadId][uniqueId].uniqueId = uniqueId;
                }

                if (callbacks.onSeen) {
                    sendMessageCallbacks[uniqueId].onSeen = callbacks.onSeen;
                    threadCallbacks[threadId][uniqueId].onSeen = false;
                }

                if (callbacks.onDeliver) {
                    sendMessageCallbacks[uniqueId].onDeliver = callbacks.onDeliver;
                    threadCallbacks[threadId][uniqueId].onDeliver = false;
                }
            }

            putInChatSendQueue({
                message: {
                    chatMessageVOType: chatMessageVOTypes.FORWARD_MESSAGE,
                    typeCode: params.typeCode,
                    subjectId: params.threadId,
                    repliedTo: params.repliedTo,
                    content: messageIdsList,
                    uniqueId: uniqueIdsList,
                    metadata: JSON.stringify(params.metadata),
                    pushMsgType: 3
                },
                callbacks: callbacks
            }, function () {
                chatSendQueueHandler();
            });
        };

        this.deliver = function (params) {
            return putInMessagesDeliveryQueue(params.threadId, params.messageId);
        };

        this.seen = function (params) {
            return putInMessagesSeenQueue(params.threadId, params.messageId);
        };

        this.startTyping = function (params) {
            var uniqueId = Utility.generateUUID();

            if (parseInt(params.threadId) > 0) {
                var threadId = params.threadId;
            }
            isTypingInterval && clearInterval(isTypingInterval);

            isTypingInterval = setInterval(function () {
                sendSystemMessage({
                    content: JSON.stringify({
                        type: systemMessageTypes.IS_TYPING
                    }),
                    threadId: threadId,
                    uniqueId: uniqueId
                });
            }, systemMessageIntervalPitch);
        };

        this.stopTyping = function () {
            isTypingInterval && clearInterval(isTypingInterval);
        };

        this.getMessageDeliveredList = function (params, callback) {

            var deliveryListData = {
                chatMessageVOType: chatMessageVOTypes.GET_MESSAGE_DELEVERY_PARTICIPANTS,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token,
                timeout: params.timeout
            };

            if (params) {
                if (parseInt(params.messageId) > 0) {
                    deliveryListData.content.messageId = params.messageId;
                }
            }

            return sendMessage(deliveryListData, {
                onResult: function (result) {
                    if (typeof result.result == 'object') {
                        for (var i = 0; i < result.result.length; i++) {
                            result.result[i] = formatDataToMakeUser(result.result[i]);
                        }
                    }
                    callback && callback(result);
                }
            });
        };

        this.getMessageSeenList = function (params, callback) {
            var seenListData = {
                chatMessageVOType: chatMessageVOTypes.GET_MESSAGE_SEEN_PARTICIPANTS,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token,
                timeout: params.timeout
            };

            if (params) {
                if (parseInt(params.messageId) > 0) {
                    seenListData.content.messageId = params.messageId;
                }
            }

            return sendMessage(seenListData, {
                onResult: function (result) {
                    if (typeof result.result == 'object') {
                        for (var i = 0; i < result.result.length; i++) {
                            result.result[i] = formatDataToMakeUser(result.result[i]);
                        }
                    }
                    callback && callback(result);
                }
            });
        };

        this.updateThreadInfo = updateThreadInfo;

        this.updateChatProfile = updateChatProfile;

        this.muteThread = function (params, callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.MUTE_THREAD,
                typeCode: params.typeCode,
                subjectId: params.threadId,
                content: {},
                pushMsgType: 3,
                token: token
            }, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.unMuteThread = function (params, callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.UNMUTE_THREAD,
                typeCode: params.typeCode,
                subjectId: params.threadId,
                content: {},
                pushMsgType: 3,
                token: token
            }, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.closeThread = function (params, callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.CLOSE_THREAD,
                typeCode: params.typeCode,
                subjectId: params.threadId,
                content: {},
                pushMsgType: 3,
                token: token
            }, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.joinPublicThread = function (params, callback) {
            var joinThreadData = {
                chatMessageVOType: chatMessageVOTypes.JOIN_THREAD,
                typeCode: params.typeCode,
                content: '',
                pushMsgType: 3,
                token: token
            };
            if (params) {
                if (typeof params.uniqueName === 'string' && params.uniqueName.length > 0) {
                    joinThreadData.content = params.uniqueName;
                }
            }
            return sendMessage(joinThreadData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.isPublicThreadNameAvailable = function (params, callback) {
            var isNameAvailableData = {
                chatMessageVOType: chatMessageVOTypes.IS_NAME_AVAILABLE,
                typeCode: params.typeCode,
                content: '',
                pushMsgType: 3,
                token: token
            };
            if (params) {
                if (typeof params.uniqueName === 'string' && params.uniqueName.length > 0) {
                    isNameAvailableData.content = params.uniqueName;
                }
            }
            return sendMessage(isNameAvailableData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.changeThreadPrivacy = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.CHANGE_THREAD_PRIVACY,
                typeCode: params.typeCode,
                pushMsgType: 3,
                content: {},
                token: token,
                timeout: params.timeout
            };

            if (params) {
                if (parseInt(params.threadId) > 0) {
                    sendData.subjectId = +params.threadId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: `No Thread Id has been sent!`
                    });
                    return;
                }

                if (typeof params.threadType === 'string' && createThreadTypes.hasOwnProperty(params.threadType.toUpperCase())) {
                    if (params.threadType.toUpperCase() === 'PUBLIC_GROUP') {
                        if (typeof params.uniqueName === 'string' && params.uniqueName.length > 0) {
                            sendData.content.uniqueName = params.uniqueName;
                        } else {
                            fireEvent('error', {
                                code: 999,
                                message: `Public Threads need a unique name! One must enter a unique name for this thread.`
                            });
                            return;
                        }
                    }

                    sendData.content.type = createThreadTypes[params.threadType.toUpperCase()];
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: `No thread type has been declared! Possible inputs are (${Object.keys(createThreadTypes).join(',')})`
                    });
                    return;
                }

            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Change thread Privacy!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.pinThread = function (params, callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.PIN_THREAD,
                typeCode: params.typeCode,
                subjectId: params.threadId,
                content: {},
                pushMsgType: 3,
                token: token
            }, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.unPinThread = function (params, callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.UNPIN_THREAD,
                typeCode: params.typeCode,
                subjectId: params.threadId,
                content: {},
                pushMsgType: 3,
                token: token
            }, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.deleteThread = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.DELETE_MESSAGE_THREAD,
                typeCode: params.typeCode
            };

            if (params) {
                if (+params.threadId > 0) {
                    sendData.subjectId = +params.threadId;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Delete Thread!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.pinMessage = function (params, callback) {
            return sendMessage({
                chatMessageVOType: chatMessageVOTypes.PIN_MESSAGE,
                typeCode: params.typeCode,
                subjectId: params.messageId,
                content: JSON.stringify({
                    'notifyAll': (typeof params.notifyAll === 'boolean') ? params.notifyAll : false
                }),
                pushMsgType: 3,
                token: token
            }, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.unPinMessage = unPinMessage;

        this.spamPrivateThread = function (params, callback) {
            var spamData = {
                chatMessageVOType: chatMessageVOTypes.SPAM_PV_THREAD,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token,
                timeout: params.timeout
            };

            if (params) {
                if (parseInt(params.threadId) > 0) {
                    spamData.subjectId = params.threadId;
                }
            }

            return sendMessage(spamData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.block = function (params, callback) {

            var blockData = {
                chatMessageVOType: chatMessageVOTypes.BLOCK,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token,
                timeout: params.timeout
            };

            if (params) {
                if (parseInt(params.contactId) > 0) {
                    blockData.content.contactId = params.contactId;
                }

                if (parseInt(params.threadId) > 0) {
                    blockData.content.threadId = params.threadId;
                }

                if (parseInt(params.userId) > 0) {
                    blockData.content.userId = params.userId;
                }
            }

            return sendMessage(blockData, {
                onResult: function (result) {
                    if (typeof result.result == 'object') {
                        result.result = formatDataToMakeBlockedUser(result.result);
                    }
                    callback && callback(result);
                }
            });
        };

        this.unblock = function (params, callback) {
            var unblockData = {
                chatMessageVOType: chatMessageVOTypes.UNBLOCK,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token,
                content: {},
                timeout: params.timeout
            };

            if (params) {
                if (parseInt(params.blockId) > 0) {
                    unblockData.subjectId = params.blockId;
                }

                if (parseInt(params.contactId) > 0) {
                    unblockData.content.contactId = params.contactId;
                }

                if (parseInt(params.threadId) > 0) {
                    unblockData.content.threadId = params.threadId;
                }

                if (parseInt(params.userId) > 0) {
                    unblockData.content.userId = params.userId;
                }
            }

            return sendMessage(unblockData, {
                onResult: function (result) {
                    if (typeof result.result == 'object') {
                        result.result = formatDataToMakeBlockedUser(result.result);
                    }

                    callback && callback(result);
                }
            });
        };

        this.getBlockedList = function (params, callback) {
            var count = 50,
                offset = 0,
                content = {};

            if (params) {
                if (parseInt(params.count) > 0) {
                    count = params.count;
                }

                if (parseInt(params.offset) > 0) {
                    offset = params.offset;
                }
            }

            content.count = count;
            content.offset = offset;

            var getBlockedData = {
                chatMessageVOType: chatMessageVOTypes.GET_BLOCKED,
                typeCode: params.typeCode,
                content: content,
                pushMsgType: 3,
                token: token,
                timeout: params.timeout
            };

            return sendMessage(getBlockedData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        var messageContent = result.result,
                            messageLength = messageContent.length,
                            resultData = {
                                blockedUsers: [],
                                contentCount: result.contentCount,
                                hasNext: (offset + count < result.contentCount && messageLength > 0),
                                nextOffset: offset * 1 + messageLength * 1
                            },
                            blockedUser;

                        for (var i = 0; i < messageLength; i++) {
                            blockedUser = formatDataToMakeBlockedUser(messageContent[i]);
                            if (blockedUser) {
                                resultData.blockedUsers.push(blockedUser);
                            }
                        }

                        returnData.result = resultData;
                    }

                    callback && callback(returnData);
                }
            });
        };

        this.getUserNotSeenDuration = function (params, callback) {
            var content = {};

            if (params) {
                if (Array.isArray(params.userIds)) {
                    content.userIds = params.userIds;
                }
            }

            var getNotSeenDurationData = {
                chatMessageVOType: chatMessageVOTypes.GET_NOT_SEEN_DURATION,
                typeCode: params.typeCode,
                content: content,
                pushMsgType: 3,
                token: token,
                timeout: params.timeout
            };

            return sendMessage(getNotSeenDurationData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        returnData.result = result.result;
                    }

                    callback && callback(returnData);
                }
            });
        };

        this.addContacts = function (params, callback) {
            var data = {};

            if (params) {
                if (typeof params.firstName === 'string') {
                    data.firstName = params.firstName;
                } else {
                    data.firstName = '';
                }

                if (typeof params.lastName === 'string') {
                    data.lastName = params.lastName;
                } else {
                    data.lastName = '';
                }

                if (typeof params.typeCode === 'string') {
                    data.typeCode = params.typeCode;
                } else if (generalTypeCode) {
                    data.typeCode = generalTypeCode;
                }

                if (typeof params.cellphoneNumber === 'string') {
                    data.cellphoneNumber = params.cellphoneNumber;
                } else {
                    data.cellphoneNumber = '';
                }

                if (typeof params.email === 'string') {
                    data.email = params.email;
                } else {
                    data.email = '';
                }

                if (typeof params.username === 'string') {
                    data.username = params.username;
                }

                data.uniqueId = Utility.generateUUID();
            }

            var requestParams = {
                url: SERVICE_ADDRESSES.PLATFORM_ADDRESS + SERVICES_PATH.ADD_CONTACTS,
                method: 'POST',
                data: data,
                headers: {
                    '_token_': token,
                    '_token_issuer_': 1
                }
            };

            httpRequest(requestParams, function (result) {
                if (!result.hasError) {
                    var responseData = JSON.parse(result.result.responseText);

                    var returnData = {
                        hasError: responseData.hasError,
                        cache: false,
                        errorMessage: responseData.message,
                        errorCode: responseData.errorCode
                    };

                    if (!responseData.hasError) {
                        var messageContent = responseData.result,
                            messageLength = responseData.result.length,
                            resultData = {
                                contacts: [],
                                contentCount: messageLength
                            },
                            contactData;

                        for (var i = 0; i < messageLength; i++) {
                            contactData = formatDataToMakeContact(messageContent[i]);
                            if (contactData) {
                                resultData.contacts.push(contactData);
                            }
                        }

                        returnData.result = resultData;

                        /**
                         * Add Contacts into cache database #cache
                         */
                        if (canUseCache && cacheSecret.length > 0) {
                            if (db) {
                                var cacheData = [];

                                for (var i = 0; i < resultData.contacts.length; i++) {
                                    try {
                                        var tempData = {},
                                            salt = Utility.generateUUID();
                                        tempData.id = resultData.contacts[i].id;
                                        tempData.owner = userInfo.id;
                                        tempData.uniqueId = resultData.contacts[i].uniqueId;
                                        tempData.userId = Utility.crypt(resultData.contacts[i].userId, cacheSecret, salt);
                                        tempData.cellphoneNumber = Utility.crypt(resultData.contacts[i].cellphoneNumber, cacheSecret, salt);
                                        tempData.email = Utility.crypt(resultData.contacts[i].email, cacheSecret, salt);
                                        tempData.firstName = Utility.crypt(resultData.contacts[i].firstName, cacheSecret, salt);
                                        tempData.lastName = Utility.crypt(resultData.contacts[i].lastName, cacheSecret, salt);
                                        tempData.expireTime = new Date().getTime() + cacheExpireTime;
                                        tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(resultData.contacts[i])), cacheSecret, salt);
                                        tempData.salt = salt;

                                        cacheData.push(tempData);
                                    } catch (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    }
                                }

                                db.contacts.bulkPut(cacheData)
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                    }

                    callback && callback(returnData);

                } else {
                    fireEvent('error', {
                        code: result.errorCode,
                        message: result.errorMessage,
                        error: result
                    });
                }
            });
        };

        this.updateContacts = function (params, callback) {
            var data = {};

            if (params) {
                if (parseInt(params.id) > 0) {
                    data.id = parseInt(params.id);
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'ID is required for Updating Contact!',
                        error: undefined
                    });
                }

                if (typeof params.firstName === 'string') {
                    data.firstName = params.firstName;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'firstName is required for Updating Contact!'
                    });
                }

                if (typeof params.lastName === 'string') {
                    data.lastName = params.lastName;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'lastName is required for Updating Contact!'
                    });
                }

                if (typeof params.cellphoneNumber === 'string') {
                    data.cellphoneNumber = params.cellphoneNumber;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'cellphoneNumber is required for Updating Contact!'
                    });
                }

                if (typeof params.email === 'string') {
                    data.email = params.email;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'email is required for Updating Contact!'
                    });
                }

                data.uniqueId = Utility.generateUUID();
            }

            var requestParams = {
                url: SERVICE_ADDRESSES.PLATFORM_ADDRESS +
                    SERVICES_PATH.UPDATE_CONTACTS,
                method: 'GET',
                data: data,
                headers: {
                    '_token_': token,
                    '_token_issuer_': 1
                }
            };

            httpRequest(requestParams, function (result) {
                if (!result.hasError) {
                    var responseData = JSON.parse(result.result.responseText);

                    var returnData = {
                        hasError: responseData.hasError,
                        cache: false,
                        errorMessage: responseData.message,
                        errorCode: responseData.errorCode
                    };

                    if (!responseData.hasError) {
                        var messageContent = responseData.result,
                            messageLength = responseData.result.length,
                            resultData = {
                                contacts: [],
                                contentCount: messageLength
                            },
                            contactData;

                        for (var i = 0; i < messageLength; i++) {
                            contactData = formatDataToMakeContact(messageContent[i]);
                            if (contactData) {
                                resultData.contacts.push(contactData);
                            }
                        }

                        returnData.result = resultData;

                        /**
                         * Add Contacts into cache database #cache
                         */
                        if (canUseCache && cacheSecret.length > 0) {
                            if (db) {
                                var cacheData = [];

                                for (var i = 0; i < resultData.contacts.length; i++) {
                                    try {
                                        var tempData = {},
                                            salt = Utility.generateUUID();
                                        tempData.id = resultData.contacts[i].id;
                                        tempData.owner = userInfo.id;
                                        tempData.uniqueId = resultData.contacts[i].uniqueId;
                                        tempData.userId = Utility.crypt(resultData.contacts[i].userId, cacheSecret, salt);
                                        tempData.cellphoneNumber = Utility.crypt(resultData.contacts[i].cellphoneNumber, cacheSecret, salt);
                                        tempData.email = Utility.crypt(resultData.contacts[i].email, cacheSecret, salt);
                                        tempData.firstName = Utility.crypt(resultData.contacts[i].firstName, cacheSecret, salt);
                                        tempData.lastName = Utility.crypt(resultData.contacts[i].lastName, cacheSecret, salt);
                                        tempData.expireTime = new Date().getTime() + cacheExpireTime;
                                        tempData.data = Utility.crypt(JSON.stringify(unsetNotSeenDuration(resultData.contacts[i])), cacheSecret, salt);
                                        tempData.salt = salt;

                                        cacheData.push(tempData);
                                    } catch (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    }
                                }

                                db.contacts.bulkPut(cacheData)
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }

                    }

                    callback && callback(returnData);

                } else {
                    fireEvent('error', {
                        code: result.errorCode,
                        message: result.errorMessage,
                        error: result
                    });
                }
            });
        };

        this.removeContacts = function (params, callback) {
            var data = {};

            if (params) {
                if (parseInt(params.id) > 0) {
                    data.id = parseInt(params.id);
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'ID is required for Deleting Contact!',
                        error: undefined
                    });
                }
            }

            var requestParams = {
                url: SERVICE_ADDRESSES.PLATFORM_ADDRESS + SERVICES_PATH.REMOVE_CONTACTS,
                method: 'POST',
                data: data,
                headers: {
                    '_token_': token,
                    '_token_issuer_': 1
                }
            };

            httpRequest(requestParams, function (result) {
                if (!result.hasError) {
                    var responseData = JSON.parse(result.result.responseText);

                    var returnData = {
                        hasError: responseData.hasError,
                        cache: false,
                        errorMessage: responseData.message,
                        errorCode: responseData.errorCode
                    };

                    if (!responseData.hasError) {
                        returnData.result = responseData.result;
                    }

                    /**
                     * Remove the contact from cache
                     */
                    if (canUseCache) {
                        if (db) {
                            db.contacts.where('id')
                                .equals(parseInt(params.id))
                                .delete()
                                .catch(function (error) {
                                    fireEvent('error', {
                                        code: 6602,
                                        message: CHAT_ERRORS[6602],
                                        error: error
                                    });
                                });
                        } else {
                            fireEvent('error', {
                                code: 6601,
                                message: CHAT_ERRORS[6601],
                                error: null
                            });
                        }
                    }

                    callback && callback(returnData);

                } else {
                    fireEvent('error', {
                        code: result.errorCode,
                        message: result.errorMessage,
                        error: result
                    });
                }
            });
        };

        this.searchContacts = function (params, callback) {
            var data = {
                    size: 50,
                    offset: 0
                },
                whereClause = {},
                returnCache = false;

            if (params) {
                if (typeof params.firstName === 'string') {
                    data.firstName = whereClause.firstName = params.firstName;
                }

                if (typeof params.lastName === 'string') {
                    data.lastName = whereClause.lastName = params.lastName;
                }

                if (parseInt(params.cellphoneNumber) > 0) {
                    data.cellphoneNumber = whereClause.cellphoneNumber = params.cellphoneNumber;
                }

                if (typeof params.email === 'string') {
                    data.email = whereClause.email = params.email;
                }

                if (typeof params.query === 'string') {
                    data.q = whereClause.q = params.query;
                }

                if (typeof params.uniqueId === 'string') {
                    data.uniqueId = whereClause.uniqueId = params.uniqueId;
                }

                if (parseInt(params.id) > 0) {
                    data.id = whereClause.id = params.id;
                }

                if (parseInt(params.typeCode) > 0) {
                    data.typeCode = whereClause.typeCode = params.typeCode;
                }

                if (parseInt(params.size) > 0) {
                    data.size = params.size;
                }

                if (parseInt(params.offset) > 0) {
                    data.offset = params.offset;
                }

                var functionLevelCache = (typeof params.cache == 'boolean') ? params.cache : true;
            }

            var requestParams = {
                url: SERVICE_ADDRESSES.PLATFORM_ADDRESS + SERVICES_PATH.SEARCH_CONTACTS,
                method: 'POST',
                data: data,
                headers: {
                    '_token_': token,
                    '_token_issuer_': 1
                }
            };

            /**
             * Search contacts in cache #cache
             */
            if (functionLevelCache && canUseCache && cacheSecret.length > 0) {
                if (db) {

                    /**
                     * First of all we delete all contacts those
                     * expireTime has been expired. after that
                     * we query our cache database to retrieve
                     * what we wanted
                     */
                    db.contacts.where('expireTime')
                        .below(new Date().getTime())
                        .delete()
                        .then(function () {

                            /**
                             * Query cache database to get contacts
                             */

                            var thenAble;

                            if (Object.keys(whereClause).length === 0) {
                                thenAble = db.contacts.where('owner')
                                    .equals(parseInt(userInfo.id));
                            } else {
                                if (whereClause.hasOwnProperty('id')) {
                                    thenAble = db.contacts.where('owner')
                                        .equals(parseInt(userInfo.id))
                                        .and(function (contact) {
                                            return contact.id === whereClause.id;
                                        });
                                } else if (whereClause.hasOwnProperty('uniqueId')) {
                                    thenAble = db.contacts.where('owner')
                                        .equals(parseInt(userInfo.id))
                                        .and(function (contact) {
                                            return contact.uniqueId === whereClause.uniqueId;
                                        });
                                } else {
                                    if (whereClause.hasOwnProperty('firstName')) {
                                        thenAble = db.contacts.where('owner')
                                            .equals(parseInt(userInfo.id))
                                            .filter(function (contact) {
                                                var reg = new RegExp(whereClause.firstName);
                                                return reg.test(chatDecrypt(contact.firstName, cacheSecret, contact.salt));
                                            });
                                    }

                                    if (whereClause.hasOwnProperty('lastName')) {
                                        thenAble = db.contacts.where('owner')
                                            .equals(parseInt(userInfo.id))
                                            .filter(function (contact) {
                                                var reg = new RegExp(whereClause.lastName);
                                                return reg.test(chatDecrypt(contact.lastName, cacheSecret, contact.salt));
                                            });
                                    }

                                    if (whereClause.hasOwnProperty('email')) {
                                        thenAble = db.contacts.where('owner')
                                            .equals(parseInt(userInfo.id))
                                            .filter(function (contact) {
                                                var reg = new RegExp(whereClause.email);
                                                return reg.test(chatDecrypt(contact.email, cacheSecret, contact.salt));
                                            });
                                    }

                                    if (whereClause.hasOwnProperty('q')) {
                                        thenAble = db.contacts.where('owner')
                                            .equals(parseInt(userInfo.id))
                                            .filter(function (contact) {
                                                var reg = new RegExp(whereClause.q);
                                                return reg.test(chatDecrypt(contact.firstName, cacheSecret, contact.salt) + ' ' +
                                                    chatDecrypt(contact.lastName, cacheSecret, contact.salt) + ' ' +
                                                    chatDecrypt(contact.email, cacheSecret, contact.salt));
                                            });
                                    }
                                }
                            }

                            thenAble.offset(data.offset)
                                .limit(data.size)
                                .toArray()
                                .then(function (contacts) {
                                    db.contacts.where('owner')
                                        .equals(parseInt(userInfo.id))
                                        .count()
                                        .then(function (contactsCount) {
                                            var cacheData = [];

                                            for (var i = 0; i < contacts.length; i++) {
                                                try {
                                                    cacheData.push(formatDataToMakeContact(JSON.parse(chatDecrypt(contacts[i].data, cacheSecret, ontacts[i].salt))));
                                                } catch (error) {
                                                    fireEvent('error', {
                                                        code: error.code,
                                                        message: error.message,
                                                        error: error
                                                    });
                                                }
                                            }

                                            var returnData = {
                                                hasError: false,
                                                cache: true,
                                                errorCode: 0,
                                                errorMessage: '',
                                                result: {
                                                    contacts: cacheData,
                                                    contentCount: contactsCount,
                                                    hasNext: !(contacts.length < data.size),
                                                    nextOffset: data.offset * 1 + contacts.length
                                                }
                                            };

                                            if (cacheData.length > 0) {
                                                callback && callback(returnData);
                                                callback = undefined;
                                                returnCache = true;
                                            }
                                        })
                                        .catch(function (error) {
                                            fireEvent('error', {
                                                code: error.code,
                                                message: error.message,
                                                error: error
                                            });
                                        });
                                })
                                .catch(function (error) {
                                    fireEvent('error', {
                                        code: error.code,
                                        message: error.message,
                                        error: error
                                    });
                                });
                        })
                        .catch(function (error) {
                            fireEvent('error', {
                                code: error.code,
                                message: error.message,
                                error: error
                            });
                        });
                } else {
                    fireEvent('error', {
                        code: 6601,
                        message: CHAT_ERRORS[6601],
                        error: null
                    });
                }
            }

            /**
             * Get Search Contacts Result From Server
             */
            httpRequest(requestParams, function (result) {
                if (!result.hasError) {
                    var responseData = JSON.parse(result.result.responseText);

                    var returnData = {
                        hasError: responseData.hasError,
                        cache: false,
                        errorMessage: responseData.message,
                        errorCode: responseData.errorCode
                    };

                    if (!responseData.hasError) {
                        var messageContent = responseData.result,
                            messageLength = responseData.result.length,
                            resultData = {
                                contacts: [],
                                contentCount: messageLength
                            },
                            contactData;

                        for (var i = 0; i < messageLength; i++) {
                            contactData = formatDataToMakeContact(messageContent[i]);
                            if (contactData) {
                                resultData.contacts.push(contactData);
                            }
                        }

                        returnData.result = resultData;

                        /**
                         * Add Contacts into cache database #cache
                         */
                        if (canUseCache && cacheSecret.length > 0) {
                            if (db) {
                                var cacheData = [];

                                for (var i = 0; i < resultData.contacts.length; i++) {
                                    try {
                                        var tempData = {},
                                            salt = Utility.generateUUID();

                                        tempData.id = resultData.contacts[i].id;
                                        tempData.owner = userInfo.id;
                                        tempData.uniqueId = resultData.contacts[i].uniqueId;
                                        tempData.userId = Utility.crypt(resultData.contacts[i].userId, cacheSecret, salt);
                                        tempData.cellphoneNumber = Utility.crypt(resultData.contacts[i].cellphoneNumber, cacheSecret, salt);
                                        tempData.email = Utility.crypt(resultData.contacts[i].email, cacheSecret, salt);
                                        tempData.firstName = Utility.crypt(resultData.contacts[i].firstName, cacheSecret, salt);
                                        tempData.lastName = Utility.crypt(resultData.contacts[i].lastName, cacheSecret, salt);
                                        tempData.expireTime = new Date().getTime() + cacheExpireTime;
                                        tempData.data = crypt(JSON.stringify(unsetNotSeenDuration(resultData.contacts[i])), cacheSecret, salt);
                                        tempData.salt = salt;

                                        cacheData.push(tempData);
                                    } catch (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    }
                                }

                                db.contacts.bulkPut(cacheData)
                                    .catch(function (error) {
                                        fireEvent('error', {
                                            code: error.code,
                                            message: error.message,
                                            error: error
                                        });
                                    });
                            } else {
                                fireEvent('error', {
                                    code: 6601,
                                    message: CHAT_ERRORS[6601],
                                    error: null
                                });
                            }
                        }
                    }

                    callback && callback(returnData);
                    /**
                     * Delete callback so if server pushes response before
                     * cache, cache won't send data again
                     */
                    callback = undefined;

                    if (!returnData.hasError && returnCache) {
                        fireEvent('contactEvents', {
                            type: 'CONTACTS_SEARCH_RESULT_CHANGE',
                            result: returnData.result
                        });
                    }
                } else {
                    fireEvent('error', {
                        code: result.errorCode,
                        message: result.errorMessage,
                        error: result
                    });
                }
            });
        };

        this.createBot = function (params, callback) {
            var createBotData = {
                chatMessageVOType: chatMessageVOTypes.CREATE_BOT,
                typeCode: params.typeCode,
                content: '',
                pushMsgType: 3,
                token: token
            };
            if (params) {
                if (typeof params.botName === 'string' && params.botName.length > 0) {
                    if (params.botName.substr(-3) === "BOT") {
                        createBotData.content = params.botName;
                    } else {
                        fireEvent('error', {
                            code: 999,
                            message: 'Bot name should end in "BOT", ex. "testBOT"'
                        });
                        return;
                    }
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Insert a bot name to create one!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'Insert a bot name to create one!'
                });
                return;
            }
            return sendMessage(createBotData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.defineBotCommand = function (params, callback) {
            var defineBotCommandData = {
                chatMessageVOType: chatMessageVOTypes.DEFINE_BOT_COMMAND,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            }, commandList = [];
            if (params) {
                if (typeof params.botName !== 'string' || params.botName.length === 0) {
                    fireEvent('error', {
                        code: 999,
                        message: 'You need to insert a botName!'
                    });
                    return;
                }
                if (!Array.isArray(params.commandList) || !params.commandList.length) {
                    fireEvent('error', {
                        code: 999,
                        message: 'Bot Commands List has to be an array of strings.'
                    });
                    return;
                } else {
                    for (var i = 0; i < params.commandList.length; i++) {
                        commandList.push('/' + params.commandList[i].trim());
                    }
                }
                defineBotCommandData.content = {
                    botName: params.botName.trim(),
                    commandList: commandList
                };
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to create bot commands'
                });
                return;
            }
            return sendMessage(defineBotCommandData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.removeBotCommand = function (params, callback) {
            var defineBotCommandData = {
                chatMessageVOType: chatMessageVOTypes.REMOVE_BOT_COMMANDS,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            }, commandList = [];

            if (params) {
                if (typeof params.botName !== 'string' || params.botName.length === 0) {
                    fireEvent('error', {
                        code: 999,
                        message: 'You need to insert a botName!'
                    });
                    return;
                }

                if (!Array.isArray(params.commandList) || !params.commandList.length) {
                    fireEvent('error', {
                        code: 999,
                        message: 'Bot Commands List has to be an array of strings.'
                    });
                    return;
                } else {
                    for (var i = 0; i < params.commandList.length; i++) {
                        commandList.push('/' + params.commandList[i].trim());
                    }
                }

                defineBotCommandData.content = {
                    botName: params.botName.trim(),
                    commandList: commandList
                };

            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to remove bot commands'
                });
                return;
            }

            return sendMessage(defineBotCommandData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.startBot = function (params, callback) {
            var startBotData = {
                chatMessageVOType: chatMessageVOTypes.START_BOT,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };
            if (params) {
                if (typeof +params.threadId !== 'number' || params.threadId < 0) {
                    fireEvent('error', {
                        code: 999,
                        message: 'Enter a valid Thread Id for Bot to start in!'
                    });
                    return;
                }
                if (typeof params.botName !== 'string' || params.botName.length === 0) {
                    fireEvent('error', {
                        code: 999,
                        message: 'You need to insert a botName!'
                    });
                    return;
                }
                startBotData.subjectId = +params.threadId;
                startBotData.content = JSON.stringify({
                    botName: params.botName.trim()
                });
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to create bot commands'
                });
                return;
            }
            return sendMessage(startBotData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.stopBot = function (params, callback) {
            var stopBotData = {
                chatMessageVOType: chatMessageVOTypes.STOP_BOT,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };
            if (params) {
                if (typeof +params.threadId !== 'number' || params.threadId < 0) {
                    fireEvent('error', {
                        code: 999,
                        message: 'Enter a valid Thread Id for Bot to stop on!'
                    });
                    return;
                }
                if (typeof params.botName !== 'string' || params.botName.length === 0) {
                    fireEvent('error', {
                        code: 999,
                        message: 'You need to insert a botName!'
                    });
                    return;
                }
                stopBotData.subjectId = +params.threadId;
                stopBotData.content = JSON.stringify({
                    botName: params.botName.trim()
                });
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to create bot commands'
                });
                return;
            }
            return sendMessage(stopBotData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.getBotCommandsList = function (params, callback) {
            var getBotCommandsListData = {
                chatMessageVOType: chatMessageVOTypes.BOT_COMMANDS,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof params.botName !== 'string' || params.botName.length === 0) {
                    fireEvent('error', {
                        code: 999,
                        message: 'You need to insert a botName!'
                    });
                    return;
                }

                getBotCommandsListData.content = JSON.stringify({
                    botName: params.botName.trim()
                });

            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to get bot commands'
                });
                return;
            }

            return sendMessage(getBotCommandsListData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.getThreadAllBots = function (params, callback) {
            var getThreadBotsData = {
                chatMessageVOType: chatMessageVOTypes.THREAD_ALL_BOTS,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof +params.threadId !== 'number' || params.threadId < 0) {
                    fireEvent('error', {
                        code: 999,
                        message: 'Enter a valid Thread Id to get all Bots List!'
                    });
                    return;
                }

                getThreadBotsData.subjectId = +params.threadId;

            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to get thread\' bots list!'
                });
                return;
            }

            return sendMessage(getThreadBotsData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.createTag = function (params, callback) {
            var createTagData = {
                chatMessageVOType: chatMessageVOTypes.CREATE_TAG,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof params.tagName === 'string' && params.tagName.length > 0) {
                    createTagData.content.name = params.tagName;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: `No tag name has been declared!`
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Create New Tag!'
                });
                return;
            }

            return sendMessage(createTagData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.editTag = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.EDIT_TAG,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (parseInt(params.tagId) > 0) {
                    sendData.subjectId = +params.tagId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: `No Tag Id has been sent!`
                    });
                    return;
                }

                if (typeof params.tagName === 'string' && params.tagName.length > 0) {
                    sendData.content.name = params.tagName;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: `No tag name has been declared!`
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Edit Tag!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.deleteTag = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.DELETE_TAG,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (parseInt(params.tagId) > 0) {
                    sendData.subjectId = +params.tagId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: `No Tag Id has been sent!`
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Delete Tag!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.getTagList = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.GET_TAG_LIST,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };

            return sendMessage(sendData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.addTagParticipants = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.ADD_TAG_PARTICIPANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (+params.tagId > 0) {
                    sendData.subjectId = +params.tagId;
                }

                if (Array.isArray(params.threadIds)) {
                    sendData.content = params.threadIds;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Add Tag PArticipants!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.removeTagParticipants = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.REMOVE_TAG_PARTICIPANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (+params.tagId > 0) {
                    sendData.subjectId = +params.tagId;
                }

                if (Array.isArray(params.threadIds)) {
                    sendData.content = params.threadIds;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Remove Tag Participants!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.registerAssistant = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.REGISTER_ASSISTANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (Array.isArray(params.assistants) && typeof params.assistants[0] === 'object') {
                    for (var i = 0; i < params.assistants.length; i++) {
                        if (typeof params.assistants[i] === 'object'
                            && params.assistants[i].hasOwnProperty('contactType')
                            && !!params.assistants[i].contactType
                            && params.assistants[i].hasOwnProperty('roleTypes')
                            && Array.isArray(params.assistants[i].roleTypes)
                            && params.assistants[i].roleTypes.length
                            && params.assistants[i].hasOwnProperty('assistant')
                            && params.assistants[i].assistant.hasOwnProperty('id')
                            && params.assistants[i].assistant.hasOwnProperty('idType')
                            && params.assistants[i].assistant.id.length
                            && inviteeVOidTypes[params.assistants[i].assistant.idType] > 0) {
                            sendData.content.push({
                                contactType: params.assistants[i].contactType,
                                roleTypes: params.assistants[i].roleTypes,
                                assistant: {
                                    id: params.assistants[i].assistant.id,
                                    idType: +inviteeVOidTypes[params.assistants[i].assistant.idType]
                                }
                            });
                        } else {
                            fireEvent('error', {
                                code: 999,
                                message: 'You should send an array of Assistant Objects each containing of contactType, roleTypes and assistant itself!'
                            });
                            return;
                        }
                    }
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'You should send an array of Assistant Objects each containing of contactType, roleTypes and assistant itself!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Create Assistants!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.deactivateAssistant = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.DEACTIVATE_ASSISTANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (Array.isArray(params.assistants) && typeof params.assistants[0] === 'object') {
                    for (var i = 0; i < params.assistants.length; i++) {
                        if (typeof params.assistants[i] === 'object'
                            && params.assistants[i].hasOwnProperty('assistant')
                            && params.assistants[i].assistant.hasOwnProperty('id')
                            && params.assistants[i].assistant.hasOwnProperty('idType')
                            && params.assistants[i].assistant.id.length
                            && inviteeVOidTypes[params.assistants[i].assistant.idType] > 0) {
                            sendData.content.push({
                                assistant: {
                                    id: params.assistants[i].assistant.id,
                                    idType: +inviteeVOidTypes[params.assistants[i].assistant.idType]
                                }
                            });
                        } else {
                            fireEvent('error', {
                                code: 999,
                                message: 'You should send an array of Assistant Objects each containing of an assistant!'
                            });
                            return;
                        }
                    }
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'You should send an array of Assistant Objects each containing of an assistant!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Deactivate Assistants!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.blockAssistant = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.BLOCK_ASSISTANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (Array.isArray(params.assistants) && typeof params.assistants[0] === 'object') {
                    for (var i = 0; i < params.assistants.length; i++) {
                        if (typeof params.assistants[i] === 'object'
                            && params.assistants[i].hasOwnProperty('assistant')
                            && params.assistants[i].assistant.hasOwnProperty('id')
                            && params.assistants[i].assistant.hasOwnProperty('idType')
                            && params.assistants[i].assistant.id.length
                            && inviteeVOidTypes[params.assistants[i].assistant.idType] > 0) {
                            sendData.content.push({
                                assistant: {
                                    id: params.assistants[i].assistant.id,
                                    idType: +inviteeVOidTypes[params.assistants[i].assistant.idType]
                                }
                            });
                        } else {
                            fireEvent('error', {
                                code: 999,
                                message: 'You should send an array of Assistant Objects each containing of an assistant!'
                            });
                            return;
                        }
                    }
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'You should send an array of Assistant Objects each containing of an assistant!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Block Assistants!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.unblockAssistant = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.UNBLOCK_ASSISTANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (Array.isArray(params.assistants) && typeof params.assistants[0] === 'object') {
                    for (var i = 0; i < params.assistants.length; i++) {
                        if (typeof params.assistants[i] === 'object'
                            && params.assistants[i].hasOwnProperty('assistant')
                            && params.assistants[i].assistant.hasOwnProperty('id')
                            && params.assistants[i].assistant.hasOwnProperty('idType')
                            && params.assistants[i].assistant.id.length
                            && inviteeVOidTypes[params.assistants[i].assistant.idType] > 0) {
                            sendData.content.push({
                                assistant: {
                                    id: params.assistants[i].assistant.id,
                                    idType: +inviteeVOidTypes[params.assistants[i].assistant.idType]
                                }
                            });
                        } else {
                            fireEvent('error', {
                                code: 999,
                                message: 'You should send an array of Assistant Objects each containing of an assistant!'
                            });
                            return;
                        }
                    }
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'You should send an array of Assistant Objects each containing of an assistant!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Unblock Assistants!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.getAssistantsList = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.GET_ASSISTANTS,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof params.contactType === 'string' && params.contactType.length) {
                    sendData.content.contactType = params.contactType;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Enter a ContactType to get all related Assistants!'
                    });
                    return;
                }

                sendData.content.count = !!params.count ? +params.count : 50;
                sendData.content.offset = !!params.offset ? +params.offset : 0;
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to get Assistants list!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.getBlockedAssistantsList = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.BLOCKED_ASSISTANTS,
                typeCode: params.typeCode,
                content: {},
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof params.contactType === 'string' && params.contactType.length) {
                    sendData.content.contactType = params.contactType;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Enter a ContactType to get all Blocked Assistants!'
                    });
                    return;
                }

                sendData.content.count = !!params.count ? +params.count : 50;
                sendData.content.offset = !!params.offset ? +params.offset : 0;
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to get Blocked Assistants list!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.getAssistantsHistory = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.ASSISTANT_HISTORY,
                typeCode: params.typeCode,
                content: {
                    offset: +params.offset > 0 ? +params.offset : 0,
                    count: +params.count > 0 ? +params.count : config.getHistoryCount
                }
            };

            if (+params.fromTime > 0 && +params.fromTime < 9999999999999) {
                sendData.content.fromTime = +params.fromTime;
            }

            if (+params.toTime > 0 && +params.toTime < 9999999999999) {
                sendData.content.toTime = +params.toTime;
            }

            if (!!params.actionType && assistantActionTypes.hasOwnProperty(params.actionType.toUpperCase())) {
                sendData.content.actionType = assistantActionTypes[params.actionType.toUpperCase()];
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };

                    if (!returnData.hasError) {
                        var messageContent = result.result,
                            messageLength = messageContent.length,
                            resultData = {
                                participants: formatDataToMakeAssistantHistoryList(messageContent),
                                contentCount: result.contentCount,
                                hasNext: (sendData.content.offset + sendData.content.count < result.contentCount && messageLength > 0),
                                nextOffset: sendData.content.offset * 1 + messageLength * 1
                            };

                        returnData.result = resultData;
                    }

                    callback && callback(returnData);
                    callback = undefined;
                }
            });
        };

        this.mapReverse = mapReverse;

        this.mapSearch = mapSearch;

        this.mapRouting = mapRouting;

        this.mapStaticImage = mapStaticImage;

        this.setAdmin = function (params, callback) {
            setRoleToUser(params, callback);
        };

        this.removeAdmin = function (params, callback) {
            removeRoleFromUser(params, callback);
        };

        this.setAuditor = function (params, callback) {
            setRoleToUser(params, callback);
        };

        this.removeAuditor = function (params, callback) {
            removeRoleFromUser(params, callback);
        };

        this.startCall = function (params, callback) {
            var startCallData = {
                chatMessageVOType: chatMessageVOTypes.CALL_REQUEST,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            }, content = {
                creatorClientDto: {}
            };

            if (params) {
                if (typeof params.type === 'string' && callTypes.hasOwnProperty(params.type.toUpperCase())) {
                    content.type = callTypes[params.type.toUpperCase()];
                } else {
                    content.type = 0x0; // Defaults to AUDIO Call
                }

                //TODO: Check for mute
                content.creatorClientDto.mute = (params.mute && typeof params.mute === 'boolean') ? params.mute : false;
                content.mute = (params.mute && typeof params.mute === 'boolean') ? params.mute : false;

                if (params.clientType
                    && typeof params.clientType === 'string'
                    && callClientTypes[params.clientType.toUpperCase()] > 0) {
                    content.creatorClientDto.clientType = callClientTypes[params.clientType.toUpperCase()];
                } else {
                    content.creatorClientDto.clientType = callClientType.WEB;
                }

                if (typeof +params.threadId === 'number' && +params.threadId > 0) {
                    content.threadId = +params.threadId;
                } else {
                    if (Array.isArray(params.invitees)) {
                        content.invitees = [];
                        for (var i = 0; i < params.invitees.length; i++) {
                            var tempInvitee = formatDataToMakeInvitee(params.invitees[i]);
                            if (tempInvitee) {
                                content.invitees.push(tempInvitee);
                            }
                        }
                    } else {
                        fireEvent('error', {
                            code: 999,
                            message: 'Invitees list is empty! Send an array of invitees to start a call with, Or send a Thread Id to start a call with current participants'
                        });
                        return;
                    }
                }

                startCallData.content = JSON.stringify(content);
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to start call!'
                });
                return;
            }

            return sendMessage(startCallData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.startGroupCall = function (params, callback) {
            var startCallData = {
                chatMessageVOType: chatMessageVOTypes.GROUP_CALL_REQUEST,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            }, content = {
                creatorClientDto: {}
            };

            if (params) {
                if (typeof params.type === 'string' && callTypes.hasOwnProperty(params.type.toUpperCase())) {
                    content.type = callTypes[params.type.toUpperCase()];
                } else {
                    content.type = 0x0; // Defaults to AUDIO Call
                }

                content.creatorClientDto.mute = (typeof params.mute === 'boolean') ? params.mute : false;

                if (params.clientType && typeof params.clientType === 'string' && callClientTypes[params.clientType.toUpperCase()] > 0) {
                    content.creatorClientDto.clientType = callClientTypes[params.clientType.toUpperCase()];
                } else {
                    content.creatorClientDto.clientType = callClientType.WEB;
                }

                if (typeof +params.threadId === 'number' && params.threadId > 0) {
                    content.threadId = +params.threadId;
                } else {
                    if (Array.isArray(params.invitees)) {
                        content.invitees = [];
                        for (var i = 0; i < params.invitees.length; i++) {
                            var tempInvitee = formatDataToMakeInvitee(params.invitees[i]);
                            if (tempInvitee) {
                                content.invitees.push(tempInvitee);
                            }
                        }
                    } else {
                        fireEvent('error', {
                            code: 999,
                            message: 'Invitees list is empty! Send an array of invitees to start a call with, Or send a Thread Id to start a call with current participants'
                        });
                        return;
                    }
                }

                startCallData.content = JSON.stringify(content);
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to start call!'
                });
                return;
            }

            return sendMessage(startCallData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.callReceived = callReceived;

        this.terminateCall = function (params, callback) {
            var terminateCallData = {
                chatMessageVOType: chatMessageVOTypes.TERMINATE_CALL,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            }, content = {};

            if (params) {
                if (typeof +params.callId === 'number' && params.callId > 0) {
                    terminateCallData.subjectId = +params.callId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Invalid call id!'
                    });
                    return;
                }

                terminateCallData.content = JSON.stringify(content);
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to terminate the call!'
                });
                return;
            }

            return sendMessage(terminateCallData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.acceptCall = function (params, callback) {
            var acceptCallData = {
                chatMessageVOType: chatMessageVOTypes.ACCEPT_CALL,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            }, content = {};

            if (params) {
                if (typeof +params.callId === 'number' && params.callId > 0) {
                    acceptCallData.subjectId = +params.callId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Invalid call id!'
                    });
                    return;
                }

                content.mute = (typeof params.mute === 'boolean') ? params.mute : false;

                content.video = (typeof params.video === 'boolean') ? params.video : false;

                content.videoCall = content.video;

                if (params.clientType && typeof params.clientType === 'string' && callClientTypes[params.clientType.toUpperCase()] > 0) {
                    content.clientType = callClientTypes[params.clientType.toUpperCase()];
                } else {
                    content.clientType = callClientType.WEB;
                }

                acceptCallData.content = JSON.stringify(content);
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to accept the call!'
                });
                return;
            }

            return sendMessage(acceptCallData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.rejectCall = this.cancelCall = function (params, callback) {
            var rejectCallData = {
                chatMessageVOType: chatMessageVOTypes.REJECT_CALL,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof +params.callId === 'number' && params.callId > 0) {
                    rejectCallData.subjectId = +params.callId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Invalid call id!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to reject the call!'
                });
                return;
            }

            return sendMessage(rejectCallData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.endCall = endCall;

        this.startRecordingCall = function (params, callback) {
            var recordCallData = {
                chatMessageVOType: chatMessageVOTypes.RECORD_CALL,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof +params.callId === 'number' && params.callId > 0) {
                    recordCallData.subjectId = +params.callId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Invalid Call id!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Record call!'
                });
                return;
            }

            return sendMessage(recordCallData, {
                onResult: function (result) {
                    restartMedia(callTopics['sendVideoTopic']);
                    callback && callback(result);
                }
            });
        };

        this.stopRecordingCall = function (params, callback) {
            var stopRecordingCallData = {
                chatMessageVOType: chatMessageVOTypes.END_RECORD_CALL,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof +params.callId === 'number' && params.callId > 0) {
                    stopRecordingCallData.subjectId = +params.callId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Invalid Call id!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Stop Recording the call!'
                });
                return;
            }

            return sendMessage(stopRecordingCallData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.startScreenShare = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.START_SCREEN_SHARE,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof +params.callId === 'number' && params.callId > 0) {
                    sendData.subjectId = +params.callId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Invalid Call id!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Share Screen!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.endScreenShare = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.END_SCREEN_SHARE,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof +params.callId === 'number' && params.callId > 0) {
                    sendData.subjectId = +params.callId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Invalid Call id!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to End Screen Sharing!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.getCallsList = function (params, callback) {
            var getCallListData = {
                chatMessageVOType: chatMessageVOTypes.GET_CALLS,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            }, content = {};

            if (params) {
                if (typeof params.count === 'number' && params.count >= 0) {
                    content.count = +params.count;
                } else {
                    content.count = 50;
                }

                if (typeof params.offset === 'number' && params.offset >= 0) {
                    content.offset = +params.offset;
                } else {
                    content.offset = 0;
                }

                if (typeof params.creatorCoreUserId === 'number' && params.creatorCoreUserId > 0) {
                    content.creatorCoreUserId = +params.creatorCoreUserId;
                }

                if (typeof params.creatorSsoId === 'number' && params.creatorSsoId > 0) {
                    content.creatorSsoId = +params.creatorSsoId;
                }

                if (typeof params.name === 'string') {
                    content.name = params.name;
                }

                if (typeof params.type === 'string' && callTypes.hasOwnProperty(params.type.toUpperCase())) {
                    content.type = callTypes[params.type.toUpperCase()];
                }

                if (Array.isArray(params.callIds)) {
                    content.callIds = params.callIds;
                }

                if (typeof params.contactType === 'string') {
                    content.contactType = params.contactType;
                }

                if (typeof params.uniqueId === 'string') {
                    content.uniqueId = params.uniqueId;
                }

                getCallListData.content = JSON.stringify(content);
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to End the call!'
                });
                return;
            }

            return sendMessage(getCallListData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.deleteFromCallList = function (params, callback) {
            var sendData = {
                chatMessageVOType: chatMessageVOTypes.DELETE_FROM_CALL_HISTORY,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (typeof params.contactType === 'string' && params.contactType.length) {
                    sendData.content.contactType = params.contactType;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'You should enter a contactType!'
                    });
                    return;
                }

                if (Array.isArray(params.callIds)) {
                    sendData.content = params.callIds;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Delete a call from Call History!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.getCallParticipants = function (params, callback) {
            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.ACTIVE_CALL_PARTICIPANTS,
                typeCode: params.typeCode,
                content: {}
            };

            if (params) {
                if (isNaN(params.callId)) {
                    fireEvent('error', {
                        code: 999,
                        message: 'Call Id should be a valid number!'
                    });
                    return;
                } else {
                    var callId = +params.callId;
                    sendMessageParams.subjectId = callId;

                    var offset = (parseInt(params.offset) > 0)
                        ? parseInt(params.offset)
                        : 0,
                        count = (parseInt(params.count) > 0)
                            ? parseInt(params.count)
                            : config.getHistoryCount;

                    sendMessageParams.content.count = count;
                    sendMessageParams.content.offset = offset;

                    return sendMessage(sendMessageParams, {
                        onResult: function (result) {
                            var returnData = {
                                hasError: result.hasError,
                                cache: false,
                                errorMessage: result.errorMessage,
                                errorCode: result.errorCode
                            };

                            if (!returnData.hasError) {
                                var messageContent = result.result,
                                    messageLength = messageContent.length,
                                    resultData = {
                                        participants: reformatCallParticipants(messageContent),
                                        contentCount: result.contentCount,
                                        hasNext: (sendMessageParams.content.offset + sendMessageParams.content.count < result.contentCount && messageLength > 0),
                                        nextOffset: sendMessageParams.content.offset * 1 + messageLength * 1
                                    };

                                returnData.result = resultData;
                            }

                            callback && callback(returnData);
                            /**
                             * Delete callback so if server pushes response before
                             * cache, cache won't send data again
                             */
                            callback = undefined;

                            if (!returnData.hasError) {
                                fireEvent('callEvents', {
                                    type: 'CALL_PARTICIPANTS_LIST_CHANGE',
                                    threadId: callId,
                                    result: returnData.result
                                });
                            }
                        }
                    });
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Get Call Participants!'
                });
                return;
            }
        };

        this.addCallParticipants = function (params, callback) {
            /**
             * + AddCallParticipantsRequest     {object}
             *    - subjectId                   {int}
             *    + content                     {list} List of CONTACT IDs or inviteeVO Objects
             *    - uniqueId                    {string}
             */

            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.ADD_CALL_PARTICIPANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (typeof params.callId === 'number' && params.callId > 0) {
                    sendMessageParams.subjectId = params.callId;
                }

                if (Array.isArray(params.contactIds)) {
                    sendMessageParams.content = params.contactIds;
                }

                if (Array.isArray(params.usernames)) {
                    sendMessageParams.content = [];
                    for (var i = 0; i < params.usernames.length; i++) {
                        sendMessageParams.content.push({
                            id: params.usernames[i],
                            idType: inviteeVOidTypes.TO_BE_USER_USERNAME
                        });
                    }
                }

                if (Array.isArray(params.coreUserids)) {
                    sendMessageParams.content = [];
                    for (var i = 0; i < params.coreUserids.length; i++) {
                        sendMessageParams.content.push({
                            id: params.coreUserids[i],
                            idType: inviteeVOidTypes.TO_BE_CORE_USER_ID
                        });
                    }
                }
            }

            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        // TODO : What is the result?!
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.removeCallParticipants = function (params, callback) {
            /**
             * + removeCallParticipantsRequest     {object}
             *    - subjectId                   {int}
             *    + content                     {list} List of Participants UserIds
             */

            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.REMOVE_CALL_PARTICIPANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (typeof params.callId === 'number' && params.callId > 0) {
                    sendMessageParams.subjectId = params.callId;
                }

                if (Array.isArray(params.userIds)) {
                    sendMessageParams.content = params.userIds;
                }
            }

            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        // TODO : What is the result?!
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.muteCallParticipants = function (params, callback) {
            /**
             * + muteCallParticipantsRequest     {object}
             *    - subjectId                   {int}
             *    + content                     {list} List of Participants UserIds
             */

            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.MUTE_CALL_PARTICIPANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (typeof params.callId === 'number' && params.callId > 0) {
                    sendMessageParams.subjectId = params.callId;
                }

                if (Array.isArray(params.userIds)) {
                    sendMessageParams.content = params.userIds;
                }
            }

            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        // TODO : What is the result?!
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.unMuteCallParticipants = function (params, callback) {
            /**
             * + unMuteCallParticipantsRequest     {object}
             *    - subjectId                   {int}
             *    + content                     {list} List of Participants UserIds
             */

            var sendMessageParams = {
                chatMessageVOType: chatMessageVOTypes.UNMUTE_CALL_PARTICIPANT,
                typeCode: params.typeCode,
                content: []
            };

            if (params) {
                if (typeof params.callId === 'number' && params.callId > 0) {
                    sendMessageParams.subjectId = params.callId;
                }

                if (Array.isArray(params.userIds)) {
                    sendMessageParams.content = params.userIds;
                }
            }

            return sendMessage(sendMessageParams, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    };
                    if (!returnData.hasError) {
                        // TODO : What is the result?!
                        var messageContent = result.result;
                        returnData.result = messageContent;
                    }
                    callback && callback(returnData);
                }
            });
        };

        this.turnOnVideoCall = function (params, callback) {
            var turnOnVideoData = {
                chatMessageVOType: chatMessageVOTypes.TURN_ON_VIDEO_CALL,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof +params.callId === 'number' && params.callId > 0) {
                    turnOnVideoData.subjectId = +params.callId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Invalid call id!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to turn on the video call!'
                });
                return;
            }

            return sendMessage(turnOnVideoData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.turnOffVideoCall = function (params, callback) {
            var turnOffVideoData = {
                chatMessageVOType: chatMessageVOTypes.TURN_OFF_VIDEO_CALL,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            };

            if (params) {
                if (typeof +params.callId === 'number' && params.callId > 0) {
                    turnOffVideoData.subjectId = +params.callId;
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Invalid call id!'
                    });
                    return;
                }
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to turn off the video call!'
                });
                return;
            }

            return sendMessage(turnOffVideoData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.resizeCallVideo = function (params, callback) {
            if (params) {
                if (!!params.width && +params.width > 0) {
                    callVideoMinWidth = +params.width;
                }

                if (!!params.height && +params.height > 0) {
                    callVideoMinHeight = +params.height;
                }

                webpeers[callTopics['sendVideoTopic']].getLocalStream().getTracks()[0].applyConstraints({
                    "width": callVideoMinWidth,
                    "height": callVideoMinHeight
                })
                    .then((res) => {
                        uiRemoteMedias[callTopics['sendVideoTopic']].style.width = callVideoMinWidth + 'px';
                        uiRemoteMedias[callTopics['sendVideoTopic']].style.height = callVideoMinHeight + 'px';
                        callback && callback();
                    })
                    .catch((e) => {
                        fireEvent('error', {
                            code: 999,
                            message: e
                        });
                    });
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to resize the video call! Send an object like {width: 640, height: 480}'
                });
                return;
            }
        }

        this.restartMedia = restartMedia;

        this.callStop = callStop;

        this.getMutualGroups = function (params, callback) {
            var count = +params.count ? +params.count : 50,
                offset = +params.offset ? +params.offset : 0;

            var sendData = {
                chatMessageVOType: chatMessageVOTypes.MUTUAL_GROUPS,
                typeCode: params.typeCode,
                content: {
                    count: count,
                    offset: offset
                }
            };

            if (params) {
                if (typeof params.user === 'object'
                    && params.user.hasOwnProperty('id')
                    && params.user.hasOwnProperty('idType')
                    && params.user.id.length
                    && inviteeVOidTypes[params.user.idType] > 0) {
                    sendData.content.toBeUserVO = {
                        id: params.user.id,
                        idType: +inviteeVOidTypes[params.user.idType]
                    };
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'You should send an user object like {id: 92, idType: "TO_BE_USER_CONTACT_ID"}'
                    });
                    return;
                }

            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to Get Mutual Groups!'
                });
                return;
            }

            return sendMessage(sendData, {
                onResult: function (result) {
                    var returnData = {
                        hasError: result.hasError,
                        cache: false,
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode,
                        uniqueId: result.uniqueId
                    };

                    if (!returnData.hasError) {
                        var messageContent = result.result,
                            messageLength = messageContent.length,
                            resultData = {
                                threads: [],
                                contentCount: result.contentCount,
                                hasNext: (offset + count < result.contentCount && messageLength > 0),
                                nextOffset: offset * 1 + messageLength * 1
                            },
                            threadData;

                        for (var i = 0; i < messageLength; i++) {
                            threadData = createThread(messageContent[i], false);
                            if (threadData) {
                                resultData.threads.push(threadData);
                            }
                        }

                        returnData.result = resultData;
                    }

                    callback && callback(returnData);
                    /**
                     * Delete callback so if server pushes response before
                     * cache, cache won't send data again
                     */
                    callback = undefined;
                }
            });
        };

        this.sendLocationPing = function (params, callback) {
            /**
             * + locationPingRequest     {object}
             *    + content              {list} A map of { location: string, locationId: int }
             */

            var locationPingData = {
                chatMessageVOType: chatMessageVOTypes.LOCATION_PING,
                typeCode: params.typeCode,
                pushMsgType: 3,
                token: token
            }, content = {};

            if (params) {
                if (typeof params.location === 'string' && locationPingTypes.hasOwnProperty(params.location.toUpperCase())) {
                    content.location = locationPingTypes[params.location.toUpperCase()];

                    if (params.location.toUpperCase() === 'THREAD') {
                        if (typeof params.threadId === 'number' && params.threadId > 0) {
                            content.locationId = +params.threadId;
                        } else {
                            fireEvent('error', {
                                code: 999,
                                message: 'You set the location to be a thread, you have to send a valid ThreadId'
                            });
                            return;
                        }
                    }
                } else {
                    fireEvent('error', {
                        code: 999,
                        message: 'Send a valid location type (CHAT / THREAD / CONTACTS)'
                    });
                    return;
                }

                locationPingData.content = JSON.stringify(content);
            } else {
                fireEvent('error', {
                    code: 999,
                    message: 'No params have been sent to LocationPing!'
                });
                return;
            }

            return sendMessage(locationPingData, {
                onResult: function (result) {
                    callback && callback(result);
                }
            });
        };

        this.clearChatServerCaches = clearChatServerCaches;

        this.deleteCacheDatabases = deleteCacheDatabases;

        this.clearCacheDatabasesOfUser = clearCacheDatabasesOfUser;

        this.getChatState = function () {
            return chatFullStateObject;
        };

        this.reconnect = function () {
            asyncClient.reconnectSocket();
        };

        this.setToken = function (newToken) {
            if (typeof newToken !== 'undefined') {
                token = newToken;
            }
        };

        this.generateUUID = Utility.generateUUID;

        this.logout = function () {
            clearChatServerCaches();

            // Delete all event callbacks
            for (var i in eventCallbacks) {
                delete eventCallbacks[i];
            }
            messagesCallbacks = {};
            sendMessageCallbacks = {};
            threadCallbacks = {};

            asyncClient.logout();
        };

        init();
    }

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = Chat;
    } else {
        if (!window.POD) {
            window.POD = {};
        }
        window.POD.Chat = Chat;
    }
})();
