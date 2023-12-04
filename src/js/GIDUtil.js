
const enumerables = ['hasOwnProperty', 'valueOf', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'constructor'];

const formatMoney = (value, currency = "EUR", lang = "de-DE") => {
    let _currency = currency ?? "EUR";

    return isNumber(Number(value)) ? (Number(value)).toLocaleString(lang, { style: 'currency', currency: _currency }) : '';
}

const isNumber = (value) => {
    return typeof value === 'number' && isFinite(value);
}
const isNumeric = (a) => {
    return !isNaN(parseFloat(a)) && isFinite(a)
}

const isString = (value) => {
    return typeof value === 'string';
}

const isEmpty = (value, allowEmptyString) => {
    return (value === null) || (value === undefined) || (!allowEmptyString ? value === '' : false) || (Array.isArray(value) && value.length === 0);
}

const cleanArray = (array) => {
    var results = [],
        i = 0,
        ln = array.length,
        item;

    for (; i < ln; i++) {
        item = array[i];

        if (!isEmpty(item)) {
            results.push(item);
        }
    }

    return results;
}

const onlyUnique = (value, index, self) => {
    return self.indexOf(value) === index;
}

const unique = (e) => {
    return e.filter(onlyUnique);
}

const clone = (item) => {
    var type,
        i,
        j,
        k,
        _clone,
        key;

    if (item === null || item === undefined) {
        return item;
    }




    if (item.nodeType && item.cloneNode) {
        return item.cloneNode(true);
    }

    type = toString.call(item);


    if (type === '[object Date]') {
        return new Date(item.getTime());
    }

    if (type === '[object Array]') {
        i = item.length;

        _clone = [];

        while (i--) {
            _clone[i] = clone(item[i]);
        }
    }

    else if (type === '[object Object]' && item.constructor === Object) {
        _clone = {};

        for (key in item) {
            _clone[key] = clone(item[key]);
        }

        if (enumerables) {
            for (j = enumerables.length; j--;) {
                k = enumerables[j];
                if (item.hasOwnProperty(k)) {
                    _clone[k] = item[k];
                }
            }
        }
    }

    return _clone || item;
}

const createGGUID = () => {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

const arraySort = function (c, b) {
    var a = b.map(function (a) {
        if (typeof a.direction === 'string') {
            a.direction = a.direction.toLowerCase() == 'asc' ? 1 : -1
        }
        return a
    });

    return c.sort(function (i, j) {
        var f = 0
            , g = 0;
        while (f < a.length && g === 0) {
            var h = a[f].prop
                , d = i[h]
                , e = j[h];
            if (typeof d == 'undefined') {
                d = ''
            }
            if (typeof e == 'undefined') {
                e = ''
            }
            if (isNumeric(d)) {
                d = Number(d)
            } else {
                d = d.toString()
            }
            if (isNumeric(e)) {
                e = Number(e)
            } else {
                e = e.toString()
            }
            g = a[f].direction * (d < e ? -1 : d > e ? 1 : 0);
            f++
        }
        return g
    })
}
export default { isNumber, isString, isEmpty, cleanArray, unique, clone, createGGUID, arraySort, isNumeric, formatMoney };