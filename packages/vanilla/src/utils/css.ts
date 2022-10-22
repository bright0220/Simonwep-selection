const unitify = (val: string | number, unit = 'px'): string => {
    return typeof val === 'number' ? val + unit : val;
};

/**
 * Add css to a DOM-Element or returns the current
 * value of a property.
 *
 * @param el The Element.
 * @param attr The attribute or an object which holds css key-properties.
 * @param val The value for a single attribute.
 * @returns {*}
 */
export function css(
    {style}: HTMLElement,
    attr: Partial<Record<string, string | number>> | string,
    val?: string | number
): void {
    if (typeof attr === 'object') {

        for (const [key, value] of Object.entries(attr)) {
            value !== undefined && style.setProperty(key, unitify(value));
        }

    } else if (val !== undefined) {
        style.setProperty(attr, unitify(val));
    }
}


