### Requested features - immediately brought to life by a bit of code

#### Allowing the user to scroll with two fingers ([#70](https://github.com/Simonwep/selection/issues/70))

```js
selection.on('beforestart', (() => {
    let timeout = null;

    return ({event}) => {

        // Check if user already tapped inside of a selection-area.
        if (timeout !== null) {

            // A second pointer-event occured, ignore that one.
            clearTimeout(timeout);
            timeout = null;
        } else {

            // Wait 50ms in case the user uses two fingers to scroll.
            timeout = setTimeout(() => {

                // OK User used only one finger, we can safely initiate a selection and reset the timer.
                selection.trigger(event);
                timeout = null;
            }, 50);
        }

        // Never start automatically.
        return false;
    };
})());
```

#### Preventing the start of a selection based on certain conditions ([#73](https://github.com/Simonwep/selection/issues/73))

```js
selection.on('beforestart', ({event}) => {
    return !event.path.some(item => {

        // item is in this case an element affected by the event-bubbeling.
        // To exclude elements with class "blocked" you could do the following (#73):
        return item.classList.contains('blocked');

        // If the areas you're using contains input elements you might want to prevent
        // any out-going selections from these elements (#72):
        return event.target.tagName !== 'INPUT';
    });
});
```

#### Preventing select from right click, middle mouse or left click ([#101](https://github.com/Simonwep/selection/issues/101))
```js
selection.on('beforestart', (event) => {
    const allowedButtons = [
        // See https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
        1, // left click
        2, // right click
        4, // mouse wheel / middle button
    ];

    return allowedButtons.includes(event.event.buttons);
});
```

> Feel free to submit a [PR](https://github.com/Simonwep/selection/compare) or create
> an [issue](https://github.com/Simonwep/selection/issues/new?assignees=Simonwep&labels=&template=feature_request.md&title=) if
> you got any ideas for more examples!

#### Preventing text-selection

As of v2.1.0, it will no longer prevent text-selection. 
If this is wanted it can be done using two of the event hooks and a bit of css:

```js
selection
    .on('beforestart', () => document.body.style.userSelect = 'none')
    .on('stop', () => document.body.style.userSelect = 'unset');
```

