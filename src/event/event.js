/**
 * @module  event
 * @author  lifesinger@gmail.com
 */

KISSY.add('event', function(S, undefined) {

    var DOM = S.DOM,
        win = window,
        doc = document,
        simpleAdd = doc.addEventListener ?
                    function(el, type, fn) {
                        if (el.addEventListener) {
                            el.addEventListener(type, fn, false);
                        }
                    } :
                    function(el, type, fn) {
                        if (el.attachEvent) {
                            el.attachEvent('on' + type, fn);
                        }
                    },
        simpleRemove = doc.removeEventListener ?
                       function(el, type, fn) {
                           if (el.removeEventListener) {
                               el.removeEventListener(type, fn, false);
                           }
                       } :
                       function(el, type, fn) {
                           if (el.detachEvent) {
                               el.detachEvent('on' + type, fn);
                           }
                       },
        EVENT_GUID = 'data-ks-event-guid',
        SPACE = ' ',
        guid = S.now(),
        // { id: { target: el, events: { type: { handle: obj, listeners: [...] } } }, ... }
        cache = { };

    var Event = {

        // such as: { 'mouseenter' : { fix: 'mouseover', handle: fn } }
        special: { },

        /**
         * Adds an event listener
         *
         * @param {String} target An element or custom EventTarget to assign the listener to
         * @param {String} type The type of event to append
         * @param {Function} fn The event handler
         */
        add: function(target, type, fn) {
            // on(target, 'click focus', fn)
            if((type = S.trim(type)) && type.indexOf(SPACE) > 0) {
                S.each(type.split(SPACE), function(t) {
                    Event.add(target, t, fn);
                });
                return;
            }

            var id = getID(target),
                special, events, eventHandle;

            // 不是有效的 target 或 参数不对
            if(id === -1 || !type || !S.isFunction(fn)) return;

            // 还没有添加过任何事件
            if (!id) {
                setID(target, (id = guid++));
                cache[id] = {
                    target: target,
                    events: { }
                };
            }

            // 没有添加过该类型事件
            events = cache[id].events;
            special = (!target.isCustomEventTarget && Event.special[type]) || { }; // special 仅针对 element
            if (!events[type]) {
                eventHandle = function(event, eventData) {
                    if (!event || !event.fixed) {
                        event = new S.EventObject(target, event, type);

                        if(S.isPlainObject(eventData)) {
                            S.mix(event, eventData);
                        }
                    }

                    if(special.setup) {
                        special.setup(event);
                    }

                    return (special.handle || Event._handle)(target, event, events[type].listeners);
                };

                events[type] = {
                    handle: eventHandle,
                    listeners: []
                };

                if(!target.isCustomEventTarget) {
                    simpleAdd(target, special.fix || type, eventHandle);
                }
                else if(target._addEvent) { // such as Node
                    target._addEvent(type, eventHandle);
                }
            }

            // 增加 listener
            events[type].listeners.push(fn);
        },

        /**
         * Detach an event or set of events from an element.
         */
        remove: function(target, type /* optional */, fn /* optional */) {
            var id = getID(target),
                events, eventsType, listeners,
                i, len, c, t;

            if (id === -1) return; // 不是有效的 target
            if(!id || !(c = cache[id])) return; // 无 cache
            if(c.target !== target) return; // target 不匹配
            events = c.events || { };

            if((eventsType = events[type])) {
                listeners = eventsType.listeners;
                len = listeners.length;

                // 移除 fn
                if(S.isFunction(fn) && len && S.inArray(fn, listeners)) {
                    t = [];
                    for(i = 0; i < len; ++i) {
                        if(fn !== listeners[i]) {
                            t.push(listeners[i]);
                        }
                    }
                    listeners = t;
                    len = t.length;
                }

                // remove(el, type)or fn 已移除光
                if(fn === undefined || len === 0) {
                    if(!target.isCustomEventTarget) {
                        simpleRemove(target, type, eventsType.handle);
                    }
                    delete cache[id].type;
                }
            }

            // remove(el) or type 已移除光
            if(type === undefined || S.isEmptyObject(events)) {
                for(type in events) {
                    Event.remove(target, type);
                }
                delete cache[id];
                removeID(target);
            }
        },

        // static
        _handle: function(target, event, listeners) {
            var ret, i = 0, len = listeners.length;

            for (; i < len; ++i) {
                ret = listeners[i].call(target, event);

                if (event.isImmediatePropagationStopped) {
                    break;
                }

                if (ret === false) {
                    event.halt();
                }
            }

            return ret;
        },

        _getCache: function(id) {
            return cache[id];
        },

        _simpleAdd: simpleAdd,
        _simpleRemove: simpleRemove
    };

    // shorthand
    Event.on = Event.add;

    function getID(target) {
        var ret = -1;

        // text and comment node
        if (target.nodeType === 3 || target.nodeType === 8) {
            return ret;
        }

        if (target.nodeType) { // HTML Element
            ret = DOM.attr(target, EVENT_GUID);
        }
        else if (target.isCustomEventTarget) { // custom EventTarget
            ret = target.eventTargetId;
        }
        else { // window, iframe, etc.
            ret = target[EVENT_GUID];
        }

        return ret;
    }

    function setID(target, id) {
        if (target.nodeType) { // HTML Element
            DOM.attr(target, EVENT_GUID, id);
        }
        else if (target.isCustomEventTarget) { // custom EventTarget
            target.eventTargetId = id;
        }
        else { // window, iframe, etc.
            try {
                target[EVENT_GUID] = id;
            } catch(e) {
                S.error(e);
            }
        }
    }

    function removeID(target) {
        if (target.nodeType) { // HTML Element
            DOM.removeAttr(target, EVENT_GUID);
        }
        else if (target.isCustomEventTarget) { // custom EventTarget
            target.eventTargetId = undefined;
        }
        else { // window, iframe, etc
            target[EVENT_GUID] = undefined;
        }
    }

    S.Event = Event;

    // Prevent memory leaks in IE
    // Window isn't included so as not to unbind existing unload events
    // More info: http://isaacschlueter.com/2006/10/msie-memory-leaks/
    if (win.attachEvent && !win.addEventListener) {
        win.attachEvent('onunload', function() {
            var id, target;
            for (id in cache) {
                if ((target = cache[id].target)) {
                    // try/catch is to handle iframes being unloaded
                    try {
                        Event.remove(target);
                    } catch(e) {
                    }
                }
            }
        });
    }
});

/**
 * TODO:
 *   - 研究 jq 的 expando cache 方式
 *   - event || window.event, 什么情况下取 window.event ? IE4 ?
 *   - 更详尽细致的 test cases
 *   - 内存泄漏测试
 *   - target 为 window, iframe 等特殊对象时的 test case
 */
