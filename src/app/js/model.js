YUI.add('model', function (Y) {

/**
@module model
@class Model
@constructor
@uses Base
**/

var GlobalEnv = YUI.namespace('Env.Model'),
    JSON      = Y.JSON || JSON,
    Lang      = Y.Lang,
    YObject   = Y.Object,

    /**
    Fired when one or more attributes on this model are changed.

    @event change
    @param {Object} new New values for the attributes that were changed.
    @param {Object} prev Previous values for the attributes that were changed.
    @param {String} src Source of the change event.
    **/
    EVT_CHANGE = 'change',

    /**
    Fired when an error occurs, such as when the model doesn't validate or when
    a server response can't be parsed.

    @event error
    @param {String} type Type of error that occurred. May be one of the
      following:

        - `parse`: An error parsing a JSON response.
        - `validate`: The model failed to validate.

    @param {mixed} error Error message, object, or exception generated by the
      error. Calling `toString()` on this should result in a meaningful error
      message.
    **/
    EVT_ERROR = 'error';

function Model() {
    Model.superclass.constructor.apply(this, arguments);
}

Y.Model = Y.extend(Model, Y.Base, {
    // -- Public Properties ----------------------------------------------------

    /**
    Hash of attributes that have changed since the last time this model was
    saved.

    @property changed
    @type {Object}
    @default {}
    **/

    /**
    Hash of attributes that were changed in the last `change` event. Each item
    in this hash is an object with the following properties:

      - `newVal`: The new value of the attribute after it changed.
      - `prevVal`: The old value of the attribute before it changed.
      - `src`: The source of the change, or `null` if no source was specified.

    @property lastChange
    @type {Object}
    @default {}
    **/

    /**
    `ModelList` instance that contains this model, or `null` if this model is
    not contained by a list.

    This property is set automatically when a model is added to or removed from
    a `ModelList` instance. You shouldn't need to set it manually. When working
    with models in a list, you should always add and remove models using the
    lists `add()` and `remove()` methods.

    @property list
    @type {ModelList}
    @default `null`
    **/

    // -- Lifecycle Methods ----------------------------------------------------
    initializer: function (config) {
        this.changed    = {};
        this.lastChange = {};

        // Temporary queue of attribute changes that are in the process of being
        // coalesced into a single change event. This hack should go away as
        // soon as Y.Attribute can coalesce attribute changes on its own.
        this._coalescing = {};
    },

    // TODO: destructor?

    // -- Public Methods -------------------------------------------------------

    'delete': function () {
        // TODO: delete!
    },

    /**
    Returns an HTML-escaped version of the value of the specified string
    attribute. The value is escaped using `Y.Escape.html()`.

    @method getAsHTML
    @param {String} name Attribute name.
    @return {String} HTML-escaped attribute value.
    **/
    getAsHTML: function (name) {
        var value = this.get(name);
        return Y.Escape.html(Lang.isValue(value) ? String(value) : '');
    },

    /**
    Returns a URL-encoded version of the value of the specified string
    attribute. The value is encoded using the native `encodeURIComponent()`
    function.

    @method getAsURL
    @param {String} name Attribute name.
    @return {String} URL-encoded attribute value.
    **/
    getAsURL: function (name) {
        var value = this.get(name);
        return encodeURIComponent(Lang.isValue(value) ? String(value) : '');
    },

    /**
    Returns `true` if any attribute of this model has been changed since the
    model was last saved.

    New models (models for which `isNew()` returns `true`) are implicitly
    considered to be "modified" until the first time they're saved.

    @method isModified
    @return {Boolean} `true` if this model has changed since it was last saved,
      `false` otherwise.
    **/
    isModified: function () {
        return this.isNew() || !YObject.isEmpty(this.changed);
    },

    /**
    Returns `true` if this model is "new", meaning it hasn't been saved since it
    was created.

    Newness is determined by checking whether the model's `id` attribute has
    been set. An empty id is assumed to indicate a new model, whereas a
    non-empty id indicates a model that was either loaded or has been saved
    since it was created.

    @method isNew
    @return {Boolean} `true` if this model is new, `false` otherwise.
    **/
    isNew: function () {
        return !this.get('id');
    },

    load: function (options) {
        // TODO: load!
    },

    /**
    Called to parse the _response_ when the model is loaded from the server.
    This method receives a server _response_ and is expected to return an
    attribute hash.

    The default implementation assumes that _response_ is either an attribute
    hash or a JSON string that can be parsed into an attribute hash. If
    _response_ is a JSON string and either `Y.JSON` or the native `JSON` object
    are available, it will be parsed automatically. If a parse error occurs, an
    `error` event will be fired and the model will not be updated.

    You may override this method to implement custom parsing logic if necessary.

    @method parse
    @param {mixed} response Server response.
    @return {Object} Attribute hash.
    **/
    parse: function (response) {
        if (typeof response === 'string') {
            if (JSON) {
                try {
                    return JSON.parse(response);
                } catch (ex) {
                    this.fire(EVT_ERROR, {
                        type : 'parse',
                        error: ex 
                    });

                    return null;
                }
            } else {
                this.fire(EVT_ERROR, {
                    type : 'parse',
                    error: 'Unable to parse response.'
                });

                Y.error("Can't parse JSON response because the json-parse "
                        + "module isn't loaded.");

                return null;
            }
        }

        return response;
    },

    save: function (attributes) {
        if (attributes && !this.set(attributes)) {
            return false;
        }

        // TODO: save!
    },

    /**
    Sets the value of one or more attributes.

    @method set
    @param {Object} attributes Hash of attribute names and values to set.
    @param {Object} [options] Data to be mixed into the event facade of the
      `change` event(s) for these attributes.
    @return {Boolean} `true` if validation succeeded and the attributes were set
      successfully, `false` otherwise.
    **/
    set: function (attributes, options) {
        var coalescing = this._coalescing,
            key;

        if (!this._validate(attributes)) {
            return false;
        }

        for (key in attributes) {
            if (YObject.owns(attributes, key)) {
                coalescing[key] = true;
                this.set(key, attributes[key], options);
            }
        }

        return true;
    },

    // Attribute changes on models should always go through set(), but we
    // override Y.Attribute's setAttrs() just in case people slip up.
    setAttrs: function (attributes) {
        return this.set(attributes);
    },

    /**
    Override this method to provide a custom persistence implementation for this
    model. The default method is a noop and doesn't actually do anything.

    This method is called internally by `load()`, `save()`, and `delete()`.

    @method sync
    @param {String} action Sync action to perform. May be one of the following:

      - `create`: Store a newly-created model for the first time.
      - `delete`: Delete an existing model.
      - 'get'   : Load an existing model.
      - `update`: Update an existing model.

    @param {Object} [options] Sync options. It's up to the custom sync
      implementation to determine what options it supports or requires, if any.
    @param {callback} [callback] Called when the sync operation finishes.
      @param {Error|null} callback.err If an error occurred, this parameter will
        contain the error. If the sync operation succeeded, _err_ will be
        `false`.
    **/
    sync: function (/* action, options, callback */) {},

    /**
    Returns a copy of this model's attributes that can be passed to
    `Y.JSON.stringify()` or used for other nefarious purposes.

    @method toJSON
    @return {Object} Copy of this model's attributes.
    **/
    toJSON: function () {
        // TODO: clone the attrs first?
        return this.getAttrs();
    },

    /**
    Reverts the last change to the model.

    If an _attrNames_ array is provided, then only the named attributes will be
    reverted (and only if they were modified in the previous change). If no
    _attrNames_ array is provided, then all changed attributes will be reverted
    to their previous values.

    Note that only one level of undo is available: from the current state to the
    previous state. If `undo()` is called when no previous state is available,
    it will simply do nothing and return `true`.

    @method undo
    @param {Array} [attrNames] Array of specific attribute names to rever. If
      not specified, all attributes modified in the last change will be
      reverted.
    @param {Object} [options] Data to be mixed into the event facade of the
      change event(s) for these attributes.
    @return {Boolean} `true` if validation succeeded and the attributes were set
      successfully, `false` otherwise.
    **/
    undo: function (attrNames, options) {
        var lastChange = this.lastChange,
            toUndo     = {},
            needUndo;

        attrNames || (attrNames = YObject.keys(lastChange));

        Y.Array.each(attrNames, function (name) {
            if (YObject.owns(lastChange, name)) {
                needUndo     = true;
                toUndo[name] = lastChange[name].prevVal;
            }
        });

        if (needUndo) {
            return this.set(toUndo, options);
        }

        return true;
    },

    /**
    Override this method to return a URL corresponding to this model's location
    on the server. The default implementation simply returns an empty string.

    The URL returned by this method will be used to make requests to the server
    or other persistence layer when this model is saved and loaded.

    @method url
    @return {String} URL for this model.
    **/
    url: function () { return ''; },

    /**
    Override this method to provide custom validation logic for this model.
    While attribute-specific validators can be used to validate individual
    attributes, this method gives you a hook to validate a hash of attributes
    when multiple attributes are changed at once. This method is called
    automatically before `set`, `setAttrs`, and `save` take action.

    A call to `validate` that doesn't return anything will be treated as a
    success. If the `validate` method returns a value, it will be treated as a
    failure, and the returned value (which may be a string or an object
    containing information about the failure) will be passed along to the
    `error` event.

    @method validate
    @param {Object} attributes Attribute hash containing changed attributes.
    @return {mixed} Any return value other than `undefined` or `null` will be
      treated as a validation failure.
    **/
    validate: function (/* attributes */) {},

    // -- Protected Methods ----------------------------------------------------

    /**
    Calls the public, overridable `validate()` method and fires an `error` event
    if validation fails.

    @method _validate
    @param {Object} attributes Attribute hash.
    @return {Boolean} `true` if validation succeeded, `false` otherwise.
    @protected
    **/
    _validate: function (attributes) {
        var error = this.validate(attributes);

        if (Lang.isValue(error)) {
            // Validation failed. Fire an error.
            this.fire(EVT_ERROR, {
                type      : 'validate',
                attributes: attributes,
                error     : error
            });

            return false;
        }

        return true;
    },

    // -- Protected Event Handlers ---------------------------------------------

    /**
    Wraps the `_defAttrChangeFn()` provided by `Y.Attribute` so we can have a
    single global notification when a change event occurs.

    @method _defAttrChangeFn
    @param {EventFacade} e
    @protected
    **/
    _defAttrChangeFn: function (e) {
        var coalescing = this._coalescing,
            key        = e.attrName;

        this.superclass.constructor._defAttrChangeFn.apply(this, e);

        if (!(e.stopped || e.prevented)) {
            delete coalescing[key];

            this.changed[key] = e.newVal;

            this.lastChange[key] = {
                newVal : e.newVal,
                prevVal: e.prevVal,
                src    : e.src || null
            };
        }

        if (YObject.isEmpty(coalescing)) {
            this.fire('change', {changed: this.lastChange});
        }
    }
}, {
    NAME: 'model',

    ATTRS: {
        /**
        A client-only identifier for this model.

        Like the `id` attribute, `clientId` may be used to retrieve model
        instances from lists. Unlike the `id` attribute, `clientId` is
        automatically generated, and is only intended to be used on the client
        during the current pageview.

        @attribute clientId
        @type String
        **/
        clientId: {valueFn: Model.generateId},

        /**
        A string that identifies this model. This id may be used to retrieve
        model instances from lists and may also be used as an identifier in
        model URLs, so it should be unique.

        If the id is empty, this model instance is assumed to represent a new
        item that hasn't yet been saved.

        @attribute id
        @type String
        @default ''.
        **/
        id: {value: ''}
    },

    /**
    Returns a clientId string that's unique among all models on the current page
    (even models in other YUI instances). Uniqueness across pageviews is
    unlikely.

    @method generateClientId
    @return {String} Unique clientId.
    @static
    **/
    generateClientId: function () {
        GlobalEnv.lastId || (GlobalEnv.lastId = 0);
        return 'c' + (GlobalEnv.lastId += 1);
    }
});

}, '@VERSION@', {
    optional: ['json-parse'],
    requires: ['base-build', 'escape']
});