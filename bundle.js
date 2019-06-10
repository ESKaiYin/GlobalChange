
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? requestAnimationFrame : noop;

    const tasks = new Set();
    let running = false;
    function run_tasks() {
        tasks.forEach(task => {
            if (!task[0](now())) {
                tasks.delete(task);
                task[1]();
            }
        });
        running = tasks.size > 0;
        if (running)
            raf(run_tasks);
    }
    function loop(fn) {
        let task;
        if (!running) {
            running = true;
            raf(run_tasks);
        }
        return {
            promise: new Promise(fulfil => {
                tasks.add(task = [fn, fulfil]);
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let stylesheet;
    let active = 0;
    let current_rules = {};
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        if (!current_rules[name]) {
            if (!stylesheet) {
                const style = element('style');
                document.head.appendChild(style);
                stylesheet = style.sheet;
            }
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        node.style.animation = (node.style.animation || '')
            .split(', ')
            .filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        )
            .join(', ');
        if (name && !--active)
            clear_rules();
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            current_rules = {};
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.shift()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            while (render_callbacks.length) {
                const callback = render_callbacks.pop();
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_render);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_render.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    let outros;
    function group_outros() {
        outros = {
            remaining: 0,
            callbacks: []
        };
    }
    function check_outros() {
        if (!outros.remaining) {
            run_all(outros.callbacks);
        }
    }
    function on_outro(callback) {
        outros.callbacks.push(callback);
    }
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick: tick$$1 = noop, css } = config;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick$$1(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            task = loop(now$$1 => {
                if (running) {
                    if (now$$1 >= end_time) {
                        tick$$1(1, 0);
                        cleanup();
                        return running = false;
                    }
                    if (now$$1 >= start_time) {
                        const t = easing((now$$1 - start_time) / duration);
                        tick$$1(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (typeof config === 'function') {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.remaining += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick: tick$$1 = noop, css } = config;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            loop(now$$1 => {
                if (running) {
                    if (now$$1 >= end_time) {
                        tick$$1(0, 1);
                        if (!--group.remaining) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.callbacks);
                        }
                        return false;
                    }
                    if (now$$1 >= start_time) {
                        const t = easing((now$$1 - start_time) / duration);
                        tick$$1(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (typeof config === 'function') {
            wait().then(() => {
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_render } = component.$$;
        fragment.m(target, anchor);
        // onMount happens after the initial afterUpdate. Because
        // afterUpdate callbacks happen in reverse order (inner first)
        // we schedule onMount callbacks before afterUpdate callbacks
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_render.forEach(add_render_callback);
    }
    function destroy(component, detaching) {
        if (component.$$) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal: not_equal$$1,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_render: [],
            after_render: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_render);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                $$.fragment.l(children(options.target));
            }
            else {
                $$.fragment.c();
            }
            if (options.intro && component.$$.fragment.i)
                component.$$.fragment.i();
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy(this, true);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    function fade(node, { delay = 0, duration = 400 }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            css: t => `opacity: ${t * o}`
        };
    }

    /* src/BlackToWhite.svelte generated by Svelte v3.4.4 */

    const file = "src/BlackToWhite.svelte";

    // (50:0) {#if covered}
    function create_if_block(ctx) {
    	var div0, div0_outro, t0, div1, div1_outro, t1, div2, div2_outro, current;

    	return {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			div0.id = "upperBlack";
    			div0.className = "svelte-12fya6n";
    			add_location(div0, file, 50, 4, 934);
    			div1.id = "lowerBlack";
    			div1.className = "svelte-12fya6n";
    			add_location(div1, file, 55, 4, 1031);
    			div2.id = "completeBlack";
    			div2.className = "svelte-12fya6n";
    			add_location(div2, file, 60, 4, 1128);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t0, anchor);
    			insert(target, div1, anchor);
    			insert(target, t1, anchor);
    			insert(target, div2, anchor);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			if (div0_outro) div0_outro.end(1);

    			if (div1_outro) div1_outro.end(1);

    			if (div2_outro) div2_outro.end(1);

    			current = true;
    		},

    		o: function outro(local) {
    			if (local) {
    				div0_outro = create_out_transition(div0, myFly, { duration: ctx.transitionDuration });
    			}

    			if (local) {
    				div1_outro = create_out_transition(div1, myFly, { duration: ctx.transitionDuration });
    			}

    			if (local) {
    				div2_outro = create_out_transition(div2, fade, { duration: ctx.transitionDuration });
    			}

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div0);
    				if (div0_outro) div0_outro.end();
    				detach(t0);
    				detach(div1);
    				if (div1_outro) div1_outro.end();
    				detach(t1);
    				detach(div2);
    				if (div2_outro) div2_outro.end();
    			}
    		}
    	};
    }

    function create_fragment(ctx) {
    	var if_block_anchor, current;

    	var if_block = (ctx.covered) && create_if_block(ctx);

    	return {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.covered) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    					if_block.i(1);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.i(1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();
    				on_outro(() => {
    					if_block.d(1);
    					if_block = null;
    				});

    				if_block.o(1);
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (if_block) if_block.i();
    			current = true;
    		},

    		o: function outro(local) {
    			if (if_block) if_block.o();
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(if_block_anchor);
    			}
    		}
    	};
    }

    function myFly(node, { delay = 0, duration = 1000 }) {
        const o = parseFloat(getComputedStyle(node).height);
        
        return {
            delay,
            duration,
            css: t => {
                return `height: ${t * o}`
                }
        };
    }

    function instance($$self, $$props, $$invalidate) {
    	let { covered = true, transitionDuration = 1000 } = $$props;

    	const writable_props = ['covered', 'transitionDuration'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<BlackToWhite> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('covered' in $$props) $$invalidate('covered', covered = $$props.covered);
    		if ('transitionDuration' in $$props) $$invalidate('transitionDuration', transitionDuration = $$props.transitionDuration);
    	};

    	return { covered, transitionDuration };
    }

    class BlackToWhite extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["covered", "transitionDuration"]);
    	}

    	get covered() {
    		throw new Error("<BlackToWhite>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set covered(value) {
    		throw new Error("<BlackToWhite>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionDuration() {
    		throw new Error("<BlackToWhite>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionDuration(value) {
    		throw new Error("<BlackToWhite>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/DomeImage.svelte generated by Svelte v3.4.4 */

    const file$1 = "src/DomeImage.svelte";

    function create_fragment$1(ctx) {
    	var img;

    	return {
    		c: function create() {
    			img = element("img");
    			img.src = "dome5.jpg";
    			img.alt = "Image of a agricultural dome";
    			img.className = "svelte-1xeava2";
    			add_location(img, file$1, 12, 0, 164);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, img, anchor);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(img);
    			}
    		}
    	};
    }

    class DomeImage extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$1, safe_not_equal, []);
    	}
    }

    /* src/Buttons.svelte generated by Svelte v3.4.4 */

    const file$2 = "src/Buttons.svelte";

    function create_fragment$2(ctx) {
    	var div5, div3, div0, button0, t1, div1, button1, t3, div2, button2, t5, div4, button3, dispose;

    	return {
    		c: function create() {
    			div5 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "WHAT HAS HAPPENED";
    			t1 = space();
    			div1 = element("div");
    			button1 = element("button");
    			button1.textContent = "WHO IS IN THE DOME";
    			t3 = space();
    			div2 = element("div");
    			button2 = element("button");
    			button2.textContent = "WHAT GOES ON INSIDE THE DOME";
    			t5 = space();
    			div4 = element("div");
    			button3 = element("button");
    			button3.textContent = "PROBLEMS AND SOLUTIONS OUTLINED IN ROZEMA AND FLOWERS";
    			button0.id = "button1";
    			button0.className = "svelte-kmmqnz";
    			add_location(button0, file$2, 10, 12, 189);
    			add_location(div0, file$2, 9, 8, 171);
    			button1.id = "button2";
    			button1.className = "svelte-kmmqnz";
    			add_location(button1, file$2, 16, 12, 338);
    			add_location(div1, file$2, 15, 8, 320);
    			button2.id = "button3";
    			button2.className = "svelte-kmmqnz";
    			add_location(button2, file$2, 22, 12, 488);
    			add_location(div2, file$2, 21, 8, 470);
    			div3.className = "row svelte-kmmqnz";
    			add_location(div3, file$2, 8, 4, 145);
    			button3.id = "button4";
    			button3.className = "svelte-kmmqnz";
    			add_location(button3, file$2, 31, 8, 665);
    			div4.className = "row svelte-kmmqnz";
    			add_location(div4, file$2, 29, 4, 638);
    			div5.className = "column svelte-kmmqnz";
    			add_location(div5, file$2, 7, 0, 120);

    			dispose = [
    				listen(button0, "click", ctx.click_handler),
    				listen(button1, "click", ctx.click_handler_1),
    				listen(button2, "click", ctx.click_handler_2),
    				listen(button3, "click", ctx.click_handler_3)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div5, anchor);
    			append(div5, div3);
    			append(div3, div0);
    			append(div0, button0);
    			append(div3, t1);
    			append(div3, div1);
    			append(div1, button1);
    			append(div3, t3);
    			append(div3, div2);
    			append(div2, button2);
    			append(div5, t5);
    			append(div5, div4);
    			append(div4, button3);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div5);
    			}

    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self) {
    	const dispatch = createEventDispatcher();

    	function click_handler(_) {
    		return dispatch("B1");
    	}

    	function click_handler_1(_) {
    		return dispatch("B2");
    	}

    	function click_handler_2(_) {
    		return dispatch("B3");
    	}

    	function click_handler_3(_) {
    		return dispatch("B4");
    	}

    	return {
    		dispatch,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3
    	};
    }

    class Buttons extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, []);
    	}
    }

    /* src/App.svelte generated by Svelte v3.4.4 */

    const file$3 = "src/App.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.line = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.dialog = list[i];
    	child_ctx.i = i;
    	return child_ctx;
    }

    // (125:0) <BlackToWhite covered={covered}>
    function create_default_slot(ctx) {
    	return {
    		c: noop,
    		m: noop,
    		d: noop
    	};
    }

    // (133:1) {#if i == count}
    function create_if_block$1(ctx) {
    	var div, t, div_class_value, current;

    	var each_value_1 = (ctx.dialog.text.split("\n"));

    	var each_blocks = [];

    	for (var i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	function outro_block(i, detaching, local) {
    		if (each_blocks[i]) {
    			if (detaching) {
    				on_outro(() => {
    					each_blocks[i].d(detaching);
    					each_blocks[i] = null;
    				});
    			}

    			each_blocks[i].o(local);
    		}
    	}

    	return {
    		c: function create() {
    			div = element("div");

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			div.id = "dialogBox";
    			div.className = div_class_value = "" + ctx.dialog.speaker + " svelte-4acwr4";
    			add_location(div, file$3, 133, 1, 6929);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.dialogList) {
    				each_value_1 = (ctx.dialog.text.split("\n"));

    				for (var i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    						each_blocks[i].i(1);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].i(1);
    						each_blocks[i].m(div, t);
    					}
    				}

    				group_outros();
    				for (; i < each_blocks.length; i += 1) outro_block(i, 1, 1);
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			for (var i = 0; i < each_value_1.length; i += 1) each_blocks[i].i();

    			current = true;
    		},

    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (135:2) {#each (dialog.text.split("\n")) as line}
    function create_each_block_1(ctx) {
    	var p, t_value = ctx.line, t, p_intro, p_outro, current;

    	return {
    		c: function create() {
    			p = element("p");
    			t = text(t_value);
    			add_location(p, file$3, 135, 3, 7022);
    		},

    		m: function mount(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			add_render_callback(() => {
    				if (p_outro) p_outro.end(1);
    				if (!p_intro) p_intro = create_in_transition(p, typewriter, {});
    				p_intro.start();
    			});

    			current = true;
    		},

    		o: function outro(local) {
    			if (p_intro) p_intro.invalidate();

    			if (local) {
    				p_outro = create_out_transition(p, fade, {});
    			}

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(p);
    				if (p_outro) p_outro.end();
    			}
    		}
    	};
    }

    // (132:0) {#each dialogList as dialog, i}
    function create_each_block(ctx) {
    	var if_block_anchor, current;

    	var if_block = (ctx.i == ctx.count) && create_if_block$1(ctx);

    	return {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},

    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.i == ctx.count) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    					if_block.i(1);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.i(1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();
    				on_outro(() => {
    					if_block.d(1);
    					if_block = null;
    				});

    				if_block.o(1);
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (if_block) if_block.i();
    			current = true;
    		},

    		o: function outro(local) {
    			if (if_block) if_block.o();
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(if_block_anchor);
    			}
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	var t0, t1, t2, button, t4, each_1_anchor, current, dispose;

    	var buttons = new Buttons({ $$inline: true });
    	buttons.$on("B1", ctx.B1_handler);
    	buttons.$on("B2", ctx.B2_handler);
    	buttons.$on("B3", ctx.B3_handler);
    	buttons.$on("B4", ctx.B4_handler);

    	var domeimage = new DomeImage({ $$inline: true });

    	var blacktowhite = new BlackToWhite({
    		props: {
    		covered: ctx.covered,
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var each_value = ctx.dialogList;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function outro_block(i, detaching, local) {
    		if (each_blocks[i]) {
    			if (detaching) {
    				on_outro(() => {
    					each_blocks[i].d(detaching);
    					each_blocks[i] = null;
    				});
    			}

    			each_blocks[i].o(local);
    		}
    	}

    	return {
    		c: function create() {
    			buttons.$$.fragment.c();
    			t0 = space();
    			domeimage.$$.fragment.c();
    			t1 = space();
    			blacktowhite.$$.fragment.c();
    			t2 = space();
    			button = element("button");
    			button.textContent = "Next";
    			t4 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			button.id = "nextButton";
    			button.className = "svelte-4acwr4";
    			toggle_class(button, "hidden", ctx.hideNext);
    			add_location(button, file$3, 127, 0, 6793);
    			dispose = listen(button, "click", ctx.clicked);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			mount_component(buttons, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(domeimage, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(blacktowhite, target, anchor);
    			insert(target, t2, anchor);
    			insert(target, button, anchor);
    			insert(target, t4, anchor);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var blacktowhite_changes = {};
    			if (changed.covered) blacktowhite_changes.covered = ctx.covered;
    			if (changed.$$scope) blacktowhite_changes.$$scope = { changed, ctx };
    			blacktowhite.$set(blacktowhite_changes);

    			if (changed.hideNext) {
    				toggle_class(button, "hidden", ctx.hideNext);
    			}

    			if (changed.count || changed.dialogList) {
    				each_value = ctx.dialogList;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    						each_blocks[i].i(1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].i(1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();
    				for (; i < each_blocks.length; i += 1) outro_block(i, 1, 1);
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			buttons.$$.fragment.i(local);

    			domeimage.$$.fragment.i(local);

    			blacktowhite.$$.fragment.i(local);

    			for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

    			current = true;
    		},

    		o: function outro(local) {
    			buttons.$$.fragment.o(local);
    			domeimage.$$.fragment.o(local);
    			blacktowhite.$$.fragment.o(local);

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

    			current = false;
    		},

    		d: function destroy(detaching) {
    			buttons.$destroy(detaching);

    			if (detaching) {
    				detach(t0);
    			}

    			domeimage.$destroy(detaching);

    			if (detaching) {
    				detach(t1);
    			}

    			blacktowhite.$destroy(detaching);

    			if (detaching) {
    				detach(t2);
    				detach(button);
    				detach(t4);
    			}

    			destroy_each(each_blocks, detaching);

    			if (detaching) {
    				detach(each_1_anchor);
    			}

    			dispose();
    		}
    	};
    }

    function typewriter(node, {speed = 60}) {
    	const valid = (
    		node.childNodes.length === 1 &&
    		node.childNodes[0].nodeType === 3
    	);

    	const text = node.textContent;
    	const duration = text.length * speed;

    	return {
    		duration,
    		tick: t => {
    			const i = ~~(text.length * t);
    			node.textContent = text.slice(0, i);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	

    	let count = 0;
    	let covered = true;
    	let hideNext = false;

    	const dialogList = [
    		{text: "Hello ID #3255007. Welcome to 2050.", speaker: "personA"},
    		{text: "Wait what did you say? Where am I? Who are you? Why is it so dark?", speaker: "personB"},
    		{text: "The year is 2050. You are in The Dome. I am POD, your personal operations device.", speaker: "personA"},
    		{text: "Would you like to enter the rooftop garden?", speaker: "personA"},
    		{text: "YES! Just get me out of this darkness now!", speaker: "personB"},
    		{text: "Command received. Opening outer door lock. Please put on your oxygen tank now.", speaker: "personA", covered: false},
    		{text: "It's 2050 and the 5th year of the dome. Climate change was not taken seriously and now the only survivors live in the dome. Those that are in the dome are desperately trying to find solutions to the issues outside using the work of a 'Rozema and Flowers' paper.", speaker: "personC"},
    		{text: "The ozone hole has doubled in size and it is dangerous to go outside the dome. Those that go out must wear protective gear to protect from UV. It is difficult for anything to grow as soils are extremely salty and there is extremely limited fresh water. Oxygen is also limited as it is too hot for most plants to photosynthesise.", speaker: "personD"},
    		{text: "There are only a handful of people within the dome. \n Ines Schroner: A botanist. He strongly believes that the only way to 'reset the earth' is to grow plants that can survive saltier conditions. He enjoys the warmth and has been caught trying to leave the dome without protective gear, claiming that 'a little sun doesn't hurt anyone'. \n Kathleen Burnell (nee Terry): A botanist who believes that cyanobacteria are the way to fix things. She has a pool in a separate room in the back of the dome that she feeds daily. \n Martin Burnell: A hardware engineer. Designed and built the dome due to the worries of his wife. Now maintains the dome and its everyday functioning. \n Victor Barker: A plumber. He believes that if irrigation systems are set up correctly, then plants should grow more easily. He regularly goes outside of the dome to check on the pipes that are set up. \n Vivienne Barker (nee Wu): A nature enthusiast. She has trees planted both inside and outside of the dome and works with Victor to keep her outside trees hydrated. She believes that planting a row of trees between each row of crops will help to provide shade and also will take up more salt from the soil.", speaker: "personD"},
    		{text: "Ines maintains the main rooftop area of the dome. He has planted some plants that are more salt tolerant and before moving to the dome, worked with scientists gentically modifying crops to make them more salt tolerant. \n Kathleen has her cyanobacteria pool. She feeds it with a nitrogen fertiliser every day in order to keep the cyanobacteria happy. \n Martin collects oxygen from the outer edge of the dome and puts it into canisters using machines that he developed in the run up to entering the dome. These canisters are used for outside expeditions and must be worn in the rooftop garden in the unlikely case of a leak. \n Victor spends most of the time within his study designing piping and how to get drip irrigation working with minimal equipment. \n Vivienne, as a mother, spends time looking after her children but also spends some time in the rooftop garden making sure that her crops are growing. She also gets some help from Ines to get crops that don't take in his sections to try to grow in her section.", speaker: "personD"},
    		{text: "The Rozema and Flowers paper 'Crops For A Salinized World' believes that, as the earth becomes saltier, we should adapt our main crops and eat crops that are more salt tolerant. Ines believes in this paper strongly and rejects the opinion that there are some flaws and biases. Kathleen is a bit sceptical about this and believes that it shouldn't be considered the only option. She knows that Ines thinks that her cyanobacteria pool is a waste of time but she continues to check up with Martin and has found that her yield of oxygen is normally similar or higher per unit than Ines'. However, she also realises that Ines' project creates edible food and so she has a lot of hope for Vivienne and Victor's projects. Victor and Vivienne try to stay out of Ines' way as he is known to not be very agreeable but they continue on with their projects as they want the future to be bright for their children. \n Everyone within the dome has pledged to be vegetarian but they raise animals in a lower level of the dome in order to preserve some animal species. The animals that have survived in the wild are now adapted to the environment but the animals in the dome are domesticated. When the dome was built a well was also dug tapping into a brackish water source which is now used by all for their plants and is purified for consumption and other human use.", speaker: "personD"},
    	];

    	function clicked() {
    		if(count <= 5){
    			if(dialogList[count] && dialogList[count].covered !== undefined) {
    				$$invalidate('covered', covered = dialogList[count].covered);
    			}
    			$$invalidate('count', count = count + 1);
    		}
    		if(count >= 6) {
    			$$invalidate('hideNext', hideNext = true);
    		}
    	}

    	function B1_handler(_) {
    		const $$result = count=7;
    		$$invalidate('count', count);
    		return $$result;
    	}

    	function B2_handler(_) {
    		const $$result = count=8;
    		$$invalidate('count', count);
    		return $$result;
    	}

    	function B3_handler(_) {
    		const $$result = count=9;
    		$$invalidate('count', count);
    		return $$result;
    	}

    	function B4_handler(_) {
    		const $$result = count=10;
    		$$invalidate('count', count);
    		return $$result;
    	}

    	return {
    		count,
    		covered,
    		hideNext,
    		dialogList,
    		clicked,
    		B1_handler,
    		B2_handler,
    		B3_handler,
    		B4_handler
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, []);
    	}
    }

    var app = new App({
    	intro: true,
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
