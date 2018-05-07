/**!
 * Selection
 * @author	Simon Reinisch
 * @license MIT
 */

(function selectionModule(factory) {
    'use strict';

    if (typeof module != 'undefined' && typeof module.exports != 'undefined') {
        module.exports = factory();
    } else if (typeof window !== 'undefined' && window.document) {
        window['Selection'] = factory();
    } else {
        throw new Error('selection.js requires a window with a document');
    }

})(function selectionFactory() {
    'use strict';

    // Constants
    const captureMode = false;

    const
        cssPrefixes = ['-moz-', '-ms-', '-o-', '-webkit-'],
        abs = Math.abs,
        max = Math.max,
        min = Math.min,
        preventDefault = ev => ev.preventDefault();

    function Selection(options) {
        this.options = options ? options : {};

        // Default options
        let defaults = {
            class: 'selection-area',
            startThreshold: 0,
            disableTouch: false,
            containers: [],
            selectables: [],
            startareas: ['html'],
            boundarys: ['html']
        };

        // Set default options
        for (let name in defaults) {
            !(name in options) && (options[name] = defaults[name]);
        }

        // Bind all private methods
        for (let fn in this) {
            if (fn.charAt(0) === '_' && typeof this[fn] === 'function') {
                this[fn] = this[fn].bind(this);
            }
        }

        this.areaElement = (() => {
            const ae = document.createElement('div');
            document.body.appendChild(ae);

            _css(ae, {
                top: 0,
                left: 0,
                position: 'fixed'
            });

            return ae;
        })();

        // Bind events
        _on(document, 'mousedown', this._onTapStart);

        if (!this.options.disableTouch) {
            _on(document, 'touchstart', this._onTapStart);
        }
    }

    Selection.prototype = {
        constructor: Selection,

        _onTapStart(evt) {
            const touch = evt.touches && evt.touches[0];
            const target = (touch || evt).target;

            const startAreas = _selectAll(this.options.startareas);
            this._boundarys = _selectAll(this.options.boundarys);

            const evtpath = _eventPath(evt);
            if (_dispatchFilterEvent(this, 'startFilter', target) === false ||
                !startAreas.find((el) => evtpath.includes(el)) ||
                !this._boundarys.find((el) => evtpath.includes(el))) {
                return;
            }

            // Save start coordinates
            this._lastX = (touch || evt).clientX;
            this._lastY = (touch || evt).clientY;

            const containers = _selectAll(this.options.containers);
            this._selectables = _selectAll(this.options.selectables);
            containers.forEach(con => this._selectables.push(...con.getElementsByTagName('*')));

            // Save current boundary
            this._targetBoundary = this._boundarys.find((el) => _intersects(el, target));

            this._touchedElements = [];
            this._changedElements = {
                added: [],
                removed: []
            };

            // New start position
            this._updateArea(evt);

            // Disable default select-action (firefox bug-fix)
            this._selectables.forEach(sel => _on(sel, 'selectstart', preventDefault));

            // Add class to the area element
            this.areaElement.classList.add(this.options.class);

            // Add listener
            _on(document, 'mousemove', this._delayedTapMove);
            _on(document, 'touchmove', this._delayedTapMove);

            _on(document, 'mouseup', this._onTapStop);
            _on(document, 'touchcancel', this._onTapStop);
            _on(document, 'touchend', this._onTapStop);

            _dispatchEvent(this, 'onStart', this.areaElement, evt, this._touchedElements, this._changedElements);
        },

        _delayedTapMove(evt) {
            const touch = evt.touches && evt.touches[0];
            const x = (touch || evt).clientX;
            const y = (touch || evt).clientY;

            if (abs((x + y) - (this._lastX + this._lastY)) >= this.options.startThreshold) {

                _off(document, 'mousemove', this._delayedTapMove);
                _off(document, 'touchmove', this._delayedTapMove);

                _on(document, 'mousemove', this._onTapMove);
                _on(document, 'touchmove', this._onTapMove);

                _css(this.areaElement, 'display', 'block');
            }
        },

        _onTapMove(evt) {
            this._updateArea(evt);
            this._updatedTouchingElements();
            const touched = this._touchedElements;
            const changed = this._changedElements;
            _dispatchEvent(this, 'onMove', this.areaElement, evt, touched, changed);
        },

        _updateArea(evt) {
            const brect = this._targetBoundary.getBoundingClientRect();
            const touch = evt.touches && evt.touches[0];
            let x2 = (touch || evt).clientX;
            let y2 = (touch || evt).clientY;

            if (x2 < brect.x) x2 = brect.x;
            if (y2 < brect.top) y2 = brect.top;
            if (x2 > brect.x + brect.width) x2 = brect.x + brect.width;
            if (y2 > brect.top + brect.height) y2 = brect.top + brect.height;

            const x3 = min(this._lastX, x2);
            const y3 = min(this._lastY, y2);
            const x4 = max(this._lastX, x2);
            const y4 = max(this._lastY, y2);

            _css(this.areaElement, {
                top: y3,
                left: x3,
                width: x4 - x3,
                height: y4 - y3
            });
        },

        _onTapStop(evt, noevent) {
            _off(document, 'mousemove', this._delayedTapMove);
            _off(document, 'touchmove', this._delayedTapMove);

            _off(document, 'mousemove', this._onTapMove);
            _off(document, 'touchmove', this._onTapMove);

            _off(document, 'mouseup', this._onTapStop);
            _off(document, 'touchcancel', this._onTapStop);
            _off(document, 'touchend', this._onTapStop);

            // Enable default select-action (firefox bug-fix)
            // Disable default select-action (firefox bug-fix)
            this._selectables.forEach(sel => _off(sel, 'selectstart', preventDefault));

            if (!noevent) {
                this._updatedTouchingElements();
                const touched = this._touchedElements;
                const changed = this._changedElements;
                _dispatchEvent(this, 'onStop', this.areaElement, evt, touched, changed);
            }

            _css(this.areaElement, 'display', 'none');
        },

        _updatedTouchingElements() {
            const touched = [];
            const changed = {
                added: [],
                removed: []
            };

            const check = ((node) => {
                if (_dispatchFilterEvent(this, 'selectionFilter', node) !== false) {

                    if (_intersects(this.areaElement, node)) {

                        // Check if the element wasn't present in the last selection.
                        if (!this._touchedElements.includes(node)) {
                            changed.added.push(node);
                        }

                        touched.push(node);
                    }

                }
            }).bind(this);

            // Itreate over the selectable elements
            this._selectables.forEach(check);

            // Check which elements where removed since lase selection
            const touchedElements = this._touchedElements;
            for (let i = touchedElements.length - 1; i >= 0; i--) {
                let el = touchedElements[i];
                if (!touched.includes(el)) {
                    changed.removed.push(el);
                }
            }

            // Save
            this._touchedElements = touched;
            this._changedElements = changed;
        },

        /**
         * Cancel the current selection process.
         * @param   {boolean} true to fire the onStop listener after cancel
         */
        cancel(keepEvent) {
            this._onTapStop(null, !keepEvent);
        },

        /**
         * Set or get an option.
         * @param   {string} name
         * @param   {*}      value
         * @return  {*}      the new value
         */
        option(name, value) {
            const options = this.options;

            if (value === void 0)
                return options[name];

            return options[name] = value;
        },

        /**
         * Disable the selection functinality.
         */
        disable() {
            _off(document, 'mousedown', this._onTapStart);
        },

        /**
         * Disable the selection functinality.
         */
        enable() {
            _on(document, 'mousedown', this._onTapStart);
        }
    }

    function _on(el, event, fn) {
        el.addEventListener(event, fn, captureMode);
    }

    function _off(el, event, fn) {
        el.removeEventListener(event, fn, captureMode);
    }

    function _css(el, attr, val) {
        const style = el && el.style;

        if (style) {

            if (typeof attr === 'object') {

                const props = Object.getOwnPropertyNames(attr);

                for (let prop of props) {
                    let val = attr[prop];
                    style[prop] = val + (typeof val === 'string' ? '' : 'px');
                }

            } else if (val === void 0) {

                if (document.defaultView && document.defaultView.getComputedStyle) {
                    val = document.defaultView.getComputedStyle(el, null);
                } else if (el.currentStyle) {
                    val = el.currentStyle;
                }

                return prop === void 0 ? val : val[attr];
            } else {

                if (!(attr in style)) {
                    for (let pref of cssPrefixes) {
                        style[pref + attr] = val + (typeof val === 'string' ? '' : 'px');
                    }
                } else {
                    style[attr] = val + (typeof val === 'string' ? '' : 'px')
                }
            }
        }
    }

    function _intersects(ela, elb) {
        const a = ela.getBoundingClientRect();
        const b = elb.getBoundingClientRect();
        return a.left + a.width >= b.left && a.left <= b.left + b.width && a.top + a.height >= b.top && a.top <= b.top + b.height;
    }

    function _dispatchFilterEvent(selection, name, node) {
        const event = selection.options[name];

        if (typeof event === 'function') {

            const evt = {
                selection: selection,
                eventName: name,
                element: node
            };

            return event.call(selection, evt);
        }
    }

    function _dispatchEvent(selection, name, ae, originalEvt, selected, changed) {
        const event = selection.options[name];

        if (typeof event === 'function') {
            const evt = {
                selection: selection,
                eventName: name,
                areaElement: ae,
                selectedElements: selected,
                changedElements: changed,
                originalEvent: originalEvt
            };

            return event.call(selection, evt);
        }
    }

    function _selectAll(selector) {
        if (!Array.isArray(selector))
            selector = [selector];

        const nodes = [];
        for (let sel of selector) {
            nodes.push(...document.querySelectorAll(sel));
        }

        return nodes;
    }

    function _eventPath(evt) {
        let path = evt.path || (evt.composedPath && evt.composedPath());
        if (path) return path;

        let el = evt.target.parentElement;

        for (path = [evt.target]; el; el = el.parentElement) {
            path.push(el);
        }

        path.push(document, window);
        return path;
    }

    // Export utils
    Selection.utils = {
        on: _on,
        off: _off,
        css: _css,
        intersects: _intersects,
        selectAll: _selectAll,
        eventPath: _eventPath
    };

    /**
     * Create selection instance
     * @param {Object} [options]
     */
    Selection.create = (options) => new Selection(options);

    // Export
    Selection.version = '0.0.5';
    return Selection;
});
