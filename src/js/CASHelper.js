// @ts-ignore
import { connect } from "@smartdesign/web-api";
import * as DataAccess from "@smartdesign/data-access";
//import "./defiant.min.js";

function errorHandler(e) {
    console.error(e);
    return Promise.reject(e);
};

export class CASHelper {
    //smartDesign = ;
    api = undefined;
    version = "v6.0"
    hash = ""
    needsLogin = true
    dataaccess = null
    user = null
    userObjectPermissionsObjects = []

    eTag = null

    constructor(autoConnect) {
        if (autoConnect) {
            console.log("Connecting to Smartdesign");
            this.connect();
        }
    }

    isNumber(value) {
        return typeof value === 'number' && isFinite(value);
    }
    isString(value) {
        return typeof value === 'string';
    }
    isEmpty(value, allowEmptyString) {
        return (value === null) || (value === undefined) || (!allowEmptyString ? value === '' : false) || (Array.isArray(value) && value.length === 0);
    }

    cleanArray(array) {
        const me = this;
        var results = [],
            i = 0,
            ln = array.length,
            item;

        for (; i < ln; i++) {
            item = array[i];

            if (!me.isEmpty(item)) {
                results.push(item);
            }
        }

        return results;

    }

    onlyUnique(value, index, self) {
        return self.indexOf(value) === index;
    }

    unique(e) {
        return e.filter(this.onlyUnique);
    }

    async connect() {
        const me = this;
        return new Promise(function (resolve, reject) {
            connect().then(api => {
                me.api = api;
                // @ts-ignore
                me.hash = api?.communicator.target().location.hash.substr(2);

                console.log(`Smartdesign connected || hash is ${me.hash}`);

                //this.smartDesign.api = api;
                me.needsLogin = false;

                const dataaccess = DataAccess.create(api, "6.0");
                me.dataaccess = dataaccess;

                dataaccess.userService
                    .getLoggedInUser()
                    .then(response => response.data)
                    .then(_user => {
                        me.user = _user;
                        console.log(`DataAccess granted || got user`);

                        resolve(me.api);

                    }).catch(err => { console.error(`DataAccess Error: ${err}`); reject(err); });

            }).catch(err => {
                console.error(`CASHelper says: Es konnte keine Verbindung zum SmartDesign hergestellt werden: ${err}`);
                me.needsLogin = true;
                reject(err);
            });
        });
    }

    async read(object, guid, fields) {
        let me = this,
            _fields = fields ? fields : '';

        // @ts-ignore
        return new Promise(function (resolve, reject) {
            me.api.fetch(`${me.version}/${object && guid ? `type/${object}/${guid}${_fields && typeof _fields !== "object" ? `?fields=${fields}` : ''}` : me.hash}`, {
                fields: fields
            }).then(function (resp) {
                if (!resp.ok) {
                    return resp.text().then(function (text) {
                        throw Error(resp.statusText + "<br>" + text);
                    });
                }

                me.eTag = resp.headers.get('eTag'); // global
                resolve(resp.json());
            }).catch(errorHandler);
        });
    }

    async create(object, fields, permissions, foreignPermission) {
        const me = this;

        // @ts-ignore
        return new Promise(function (resolve, reject) {
            me.api.fetch(`${me.version}/${object ? `type/${object}` : me.hash}?tag-as-recently-used`, {
                method: 'POST',
                dataType: "json",

                disableCaching: false,
                crossDomain: true,
                body: `{"fields":${(typeof fields === 'string' ? fields : JSON.stringify(fields))}${permissions ? `,"permissions":${(typeof permissions === 'string' ? permissions : JSON.stringify(permissions))}` : ''}${foreignPermission || me.isNumber(foreignPermission) ? `,"foreignEditPermission": ${foreignPermission}` : ''}}`
            })
                .then((resp) => {
                    if (!resp.ok) {
                        return resp.text().then(function (text) {
                            throw Error(resp.statusText + "<br>" + text);
                        });
                    }
                    let _location = resp.headers.get('location');
                    if (!_location) {
                        resolve(true);
                    } else {
                        let guid = _location.substr(_location.lastIndexOf('/') + 1);
                        //me.setRecent(object, guid);
                        resolve(guid); // returns object gguid
                    }

                })
                .catch(errorHandler)
        });
    }

    async update(object, guid, fields, permissions, foreignPermission) {
        let me = this,
            // @ts-ignore
            obj = await me.read.apply(me, arguments),
            eTag = me.eTag;

        return new Promise(function (resolve, reject) {
            me.api.fetch((`${me.version}/${object && guid ? `type/${object}/${guid}` : this.hash}?tag-as-recently-used`), {
                method: 'PUT',

                body: `{"fields":${(typeof fields === 'string' ? fields : JSON.stringify(fields))}${permissions ? `,"permissions":${(typeof permissions === 'string' ? permissions : JSON.stringify(permissions))}` : ''}${foreignPermission || me.isNumber(foreignPermission) ? `,"foreignEditPermission": ${foreignPermission}` : ''}}`,
                headers: {
                    'Content-Type': "application/json; charset=utf-8",
                    'If-Match': eTag ? eTag : me.eTag
                }
            }).then(function (resp) {

                if (!resp.ok) {
                    reject(resp);
                    resp.text().then(function (text) {
                        throw Error(resp.statusText + "<br>" + text);
                    });

                } else {
                    // @ts-ignore
                    let eTag = me.eTag = resp.headers.get('eTag');
                    resolve(guid);
                }
            }).catch(errorHandler);
        });
    }

    async saveOrUpdate(objectName = "ADDRESS", objects = [], permissions, foreignPermission) {
        const me = this;
        var results = [],
            objs = Array.isArray(objects) ? objects : [objects];

        return objs.reduce(async (previousPromise, nextObj) => {
            await previousPromise;

            //debugger;
            if (nextObj.GGUID) {
                return me.update(objectName, nextObj.GGUID, nextObj, permissions, foreignPermission).then((res) => {
                    console.log('data is updated..');
                    results.push(res);
                    return results;
                })
            } else {
                return me.create(objectName, nextObj, permissions, foreignPermission).then((res) => {
                    //debugger;
                    console.log('data is saved..');
                    results.push(res);
                    return results;
                })
            }
        }, Promise.resolve())
            .then(function () {
                return results;
            }).catch(errorHandler);
    }

    async duplicate(object = "DOCUMENT", gguid, fields = {}, permissions, foreignPermission, copyLinks = false, copyPermissions = true, asTemplate = false) {
        const me = this;

        // @ts-ignore
        return new Promise(function (resolve, reject) {
            me.api.fetch(`${me.version}/${object ? `type/${object}` : me.hash}/duplicate?gguid=${gguid}${copyLinks ? `&copy-links=${copyLinks}` : ''}${copyPermissions ? `&copy-permissions=${copyPermissions}` : ''}${asTemplate ? `&duplicate-as-template=${asTemplate}` : ''}`, {
                method: 'POST',
                dataType: "json",
                disableCaching: false,
                crossDomain: true
            })
                .then(resp => {
                    if (!resp.ok) {
                        return resp.text().then(function (text) {
                            throw Error(resp.statusText + "<br>" + text);
                        });
                    }
                    me.eTag = resp.headers.get('eTag'); // global
                    return resp.json();
                })
                .then(cRes => {
                    let _gguid = cRes.id;

                    me.api.fetch(`${me.version}/${object ? `type/${object}` : me.hash}/duplicate/${_gguid}`, {
                        method: 'POST',
                        dataType: "json",
                        disableCaching: false,
                        crossDomain: true,
                        ...(fields ? { body: `{"fields":${(typeof fields === 'string' ? fields : JSON.stringify(fields))}${permissions ? `,"permissions":${(typeof permissions === 'string' ? permissions : JSON.stringify(permissions))}` : ''}${foreignPermission || me.isNumber(foreignPermission) ? `,"foreignEditPermission": ${foreignPermission}` : ''}}` } : {})
                    })
                        .then(async (resp) => {
                            if (!resp.ok) {
                                return resp.text().then(function (text) {
                                    throw Error(resp.statusText + "<br>" + text);
                                });
                            }
                            resolve(_gguid);
                        }).catch(errorHandler)


                }).catch(errorHandler);
        });
    }


    async query(object, fields, condition, teamfilter, _opts, orderBy) {
        const me = this;
        let searchArr = [],
            currentPage = _opts && _opts.currentPage ? _opts.currentPage : 1,
            lastPage = _opts && _opts.lastPage ? _opts.lastPage : null,
            pageSize = _opts && _opts.pageSize ? _opts.pageSize : 1000,
            resArr = [],
            _condition = (condition ? ` WHERE ${condition}` : ''),
            _orderBy = (orderBy ? ` ORDER BY ${orderBy}` : ''),
            _teamfilter = (teamfilter ? teamfilter === "false" ? '' : ` TEAMFILTER(${object};${teamfilter})` : ` TEAMFILTER(${object};CASLoggedInUser,CASPublicRecords,CASExternalAccess)`),
            _params, _fields;

        _fields = fields ? (typeof fields === 'string' ? fields.split(',') : fields).map(field => field.trim()) : [];

        if (fields && !_fields.includes('GGUID'))
            _fields.unshift('GGUID');

        _fields = _fields.join();

        if (_opts && _opts.params) {
            _params = JSON.stringify({
                "query": `${_opts.params}${_teamfilter}${_orderBy}`
            });

        } else {
            _params = JSON.stringify({
                "query": `SELECT ${_fields ? 'DISTINCT ' : ''}${_fields ? _fields : '*'} FROM ${object}${_condition}${_teamfilter}${_orderBy}`
            });
        }

        function doSearch() {
            return new Promise(function (resolve, reject) {
                me.api.fetch(`${me.version}/query?page=${currentPage}&entries-per-page=${pageSize}`, {
                    method: 'POST',
                    dataType: "json",

                    disableCaching: false,
                    crossDomain: true,
                    body: _params
                }).then(function (resp) {

                    if (!me.isString(resp) && !resp.ok) {
                        reject(resp);
                        resp.text().then(function (text) {
                            throw Error(resp.statusText + "<br>" + text);
                        });

                    } else if (me.isString(resp) || resp.ok) {
                        if (typeof resp.json === "function")
                            return resp.json();
                        else
                            return JSON.parse(resp);
                    }

                }).then(async (json) => {
                    let JSONresult = json;

                    JSONresult = json && json[0] ? json[0].rows : null;

                    if (JSONresult)
                        resArr = [...resArr, ...JSONresult];

                    if (JSONresult && (JSONresult.length === Number(pageSize)) && (!lastPage || currentPage <= lastPage)) {
                        ++currentPage;
                        return await doSearch.apply(this, arguments);
                    } else {

                        if (json && json[0])
                            json[0].rows = resArr;
                        return json && json[0] ? json[0] : [];
                    }

                }).then((result) => {
                    resolve(result);
                }).catch(errorHandler);
            });
        };

        searchArr.push(doSearch());

        // @ts-ignore
        return new Promise(function (resolve, reject) {
            Promise.all(searchArr).then((arr) => {
                let res = arr && arr[0] ? arr[0] : [];

                resolve(res);
            }).catch(errorHandler);
        });

    }

    async getDependentDataObjects(object = "GWOPPORTUNITY", guid, type = "list") {
        let me = this,
            dependentType = object.toUpperCase() + "POS";

        return new Promise(function (resolve, reject) {
            me.api.fetch(`${me.version}/${object && guid ? `type/${object}/${guid}/dependenttype/${dependentType}/${type}` : this.hash}`)
                .then(function (resp) {
                    if (!resp.ok) {
                        reject(resp);
                        resp.text().then(function (text) {
                            throw Error(resp.statusText + "<br>" + text);
                        });

                    } else {
                        resolve(resp.json());
                    }
                }).catch(errorHandler);
        });
    }

    async transferLink(fromObj, fromId, toObj, toId) {
        const me = this;

        let source = { obj: fromObj, id: fromId },
            target = { obj: toObj, id: toId },

            uop = await me.getUserObjecttypePermissions(true),
            aLinks = await me.getPrimarylinkparents(source.obj, source.id),

            // @ts-ignore
            lArr = [],
            links = [];

        if (!aLinks.length) {
            source = {
                obj: toObj,
                id: toId
            },

                target = {
                    obj: fromObj,
                    id: fromId
                };

            aLinks = await me.getPrimarylinkparents(source.obj, source.id);
        }

        try {
            // @ts-ignore
            let match = JSON.search(uop, `//*[DataObject="${target.obj}"]`)[0];
            links = match.links;
            lArr = match.primaryLinkParents.parentObjectTypes;
        } catch (err) { }

        aLinks.forEach(async (lObj) => {
            //
            let object = lObj.objectType,
                gguid = lObj.gguid,

                _links = links[object],

                link, linkName;

            if (_links) {
                try {
                    // @ts-ignore
                    link = JSON.search(_links, `//*[ contains(linkAttribute, "ITD")  or sourceRole = "Primärverknüpfung"]`)[0];
                } catch (err) { }
            }

            if (link) {
                linkName = link.linkAttribute;
                console.log(`Creating primarylinkParent: ${linkName}`)

                await me.createLink({
                    obj1: object,
                    obj2: target.obj,
                    gguid1: gguid,
                    gguid2: target.id,
                    linkName: linkName
                }, false);
            }


        });

    }

    async getPrimarylinkparents(object, gguid) {
        const me = this;
        return new Promise(resolve => {
            me.api.fetch(`${me.version}/type/${object}/${gguid}/primarylinkparents`, {
                method: 'GET',

                //body: `{fields:${(typeof fields === 'string' ? fields : JSON.stringify(fields))}}`,
                /*
                headers: {
                    'Content-Type': "application/json; charset=utf-8",
                    //'If-Match': me.eTag
                }
                */
            }).then(function (json) {
                resolve(json.json());
            }).catch(errorHandler);
        });
    }

    async createLink(link, transfer = true) {
        const me = this,
            // @ts-ignore
            _opts = me.options;

        var {
            obj1,
            obj2,
            gguid1,
            gguid2,
            linkName
        } = link;

        let o1 = obj1,
            o2 = obj2,
            oi1 = gguid1,
            oi2 = gguid2,
            tableSign;

        if (!linkName) {
            let uop = await me.getUserObjecttypePermissions(true, [o1, o2]);

            try {
                // @ts-ignore
                if (typeof Defiant !== "undefined") {
                    // @ts-ignore
                    let snap = Defiant.getSnapshot(uop),
                        // @ts-ignore
                        oo = JSON.search(snap, `//*[DataObject="${o1}"]`)[0];

                    tableSign = oo.tableSign;

                    // @ts-ignore
                    linkName = JSON.search(oo, `//*/links/${o2}[ contains(linkAttribute, "ITD")  or sourceRole = "Primärverknüpfung"]/linkAttribute`)[0];

                    if (!linkName && oo?.primaryLinkParents?.parentObjectTypes?.includes(o2)) {
                        /** @INFO CHECK IF THIS OBJECT COULD BE LINKED VIA PRIMARYLINKPLUS */
                        linkName = "PRIMARYLINKPLUS";
                    }

                    console.log(`%c"${o1}" will be linked to ${o2}, with linkName "${linkName}"`, "color:white; background: rgb(131,58,180); background: linear-gradient(90deg, rgba(131,58,180,1) 0%, rgba(253,29,29,1) 50%, rgba(252,176,69,1) 100%); padding:.5em; border-radius: 1em;");
                }
            } catch (err) { }
        }

        if (tableSign && linkName && linkName.startsWith("ITD")) {
            if (!linkName.slice(3).startsWith(tableSign)) {
                o1 = obj2;
                o2 = obj1;
                oi1 = gguid2;
                oi2 = gguid1;
            }
        }

        return new Promise(resolve => {
            me.api.fetch(`${me.version}/type/${o1}/${oi1}/dossier?gguid2=${oi2}&object-type2=${o2}${linkName ? '&attribute=' + linkName : ''}`, {
                method: 'POST',

                //body: `{fields:${(typeof fields === 'string' ? fields : JSON.stringify(fields))}}`,
                headers: {
                    'content-type': "application/json; charset=utf-8",
                    //'If-Match': me.eTag
                }
            }).then(async function (json) {
                if (linkName === "PRIMARYLINKPLUS")
                    // @ts-ignore
                    await me.saveOrUpdate(o2, { "GGUID": Array.isArray(oi2) ? oi2[0] : oi2, [`PARENT${o1}GUID`]: Array.isArray(oi1) ? oi1[0] : oi1 });

                if (transfer)
                    await me.transferLink(o1, oi1, o2, oi2);

                resolve(json);
            }).catch(errorHandler);
        });
    }

    async createLinks(links = [], transfer) {
        const me = this;
        var results = [],
            objs = Array.isArray(links) ? links : [links];

        return objs.reduce(async (previousPromise, nextObj) => {
            await previousPromise;

            //debugger;
            return me.createLink(nextObj, transfer).then((res) => {
                console.log('link created');
                results.push(res);
                return results;
            })

        }, Promise.resolve())
            .then(function () {
                return results;
            }).catch(errorHandler);
    }

    async deleteLink(link) { // <version>/type/{dataObjectType}/{GGUID}/dossier/{SourceGGUID}@{SourceDataObjectType}@{DestinationGGUID}@{DestinationObjectType}
        const me = this,
            // @ts-ignore
            _opts = me.options;

        var {
            obj1,
            gguid1,

            obj2,
            gguid2,
        } = link;

        return new Promise(resolve => {
            me.api.fetch(`${me.version}/type/${obj1}/${gguid1}/dossier/${gguid1}@${obj1}@${gguid2}@${obj2}`, {
                method: 'DELETE',

                headers: {
                    'Content-Type': "application/json; charset=utf-8"
                }
            }).then(function (json) {
                resolve(json);
            }).catch(errorHandler);
        });
    }

    async search(object = "ADDRESS", condition = "", order = "") {
        const me = this;

        return new Promise(resolve => {
            me.api.Search.openSearch(object, {
                orderBy: order,
                where: condition,
                showResultsWithEmptySearchTerm: true
            }).then(searchResponse => resolve(searchResponse.objectGguids));
        });

    }

    async getMetadata(object) {
        const me = this;

        return new Promise(resolve => {
            // @ts-ignore
            if (typeof me.metadata === 'undefined')
                // @ts-ignore
                me.metadata = {};

            // @ts-ignore
            if (me.metadata[object])
                // @ts-ignore
                resolve(me.metadata[object]);
            else {
                me.api.fetch(`${me.version}/metadata?object-types=${object}`).then(response => {
                    return response.json();
                }).then((json) => {
                    // @ts-ignore
                    me.metadata[object] = json;
                    resolve(json);
                }).catch(errorHandler);
            }

        });
    }

    async getUserObjecttypePermissions(advanced = false, _objects = []) { // advanced merges the metadata into the object
        let me = this;

        let checker = (arr = [], target) => target.every(v => arr.includes(v));

        // @ts-ignore
        if (advanced && me.userObjectPermissions && (!_objects || checker(me.userObjectPermissionsObjects, _objects))) {
            // @ts-ignore
            return me.userObjectPermissions;
        }

        // @ts-ignore
        return new Promise(function (resolve, reject) {
            me.api.fetch(`${me.version}/user/self/dataobjecttypepermission/list`).then(async function (resp) {
                if (!resp.ok) {
                    return resp.text().then(function (text) {
                        throw Error(resp.statusText + "<br>" + text);
                    });
                }

                if (advanced) {
                    let objects = await resp.json(),
                        retArr = [];

                    if (!me.userObjectPermissionsObjects)
                        me.userObjectPermissionsObjects = [];

                    me.userObjectPermissionsObjects = me.unique([...me.userObjectPermissionsObjects, ..._objects]);

                    console.log(`USEROBJECTPERMISSIONOBJECTS: ${me.userObjectPermissionsObjects.join(", ")}`);

                    await Promise.all(objects.map(async (object) => {
                        let obj = object.DataObject,
                            meta = { [obj]: {} };

                        if (_objects && _objects.length > 0) {

                            if (me.userObjectPermissionsObjects.includes(obj))
                                meta = await me.getMetadata(obj);
                        } else {
                            meta = await me.getMetadata(obj);
                        }

                        retArr.push({ ...object, ...meta[obj] });
                    }));

                    // @ts-ignore
                    if (!me.userObjectPermissions)
                        // @ts-ignore
                        me.userObjectPermissions = [];

                    // @ts-ignore
                    me.userObjectPermissions = [...me.userObjectPermissions, ...retArr];

                    resolve(retArr);
                } else {
                    resolve(resp.json());
                }
            }).catch(errorHandler);
        });
    }

    // @ts-ignore
    async getObjectPermissions(object = "ADDRESS", gguid, advanced = false) {
        let me = this;

        // @ts-ignore
        return new Promise(function (resolve, reject) {
            me.api.fetch(`${me.version}/type/${object}/${gguid}/permission/full`).then(function (resp) {
                if (!resp.ok) {
                    return resp.text().then(function (text) {
                        throw Error(resp.statusText + "<br>" + text);
                    });
                }
                resolve(resp.json());
            }).catch(errorHandler);
        });
    }

    async getSelf(fields) {
        let me = this,
            _fields = fields ? fields : '';

        // @ts-ignore
        return new Promise(function (resolve, reject) {
            me.api.fetch(`${me.version}/user/self${_fields && typeof _fields !== "object" ? `?fields=${fields}` : ''}`, {
                fields: fields
            }).then(function (resp) {
                if (!resp.ok) {
                    return resp.text().then(function (text) {
                        throw Error(resp.statusText + "<br>" + text);
                    });
                }
                resolve(resp.json());
            }).catch(errorHandler);
        });
    }

    async getSchema(_object) {
        let me = this,
            object = _object;

        if (typeof me.schemas === 'undefined')
            me.schemas = {};

        if (!object && me.hash) {
            try {
                // @ts-ignore
                object = CASConnector.hash.split("/")[1].toUpperCase()
            } catch (e) {
                object = "ADDRESS";
            }
        } else if (!object) {
            object = "ADDRESS";
        }

        // @ts-ignore
        return new Promise(function (resolve, reject) {
            if (me.schemas[object])
                resolve(me.schemas[object]);
            else {
                me.api.fetch(`${me.version}/type/${object.toUpperCase()}/schema`)
                    .then(function (resp) {
                        if (!resp.ok) {
                            return resp.text().then(function (text) {
                                throw Error(resp.statusText + "<br>" + text);
                            });
                        }
                        return resp.json();
                    })
                    .then(json => {
                        let data = json ? json.properties.fields : {};
                        me.schemas[object] = data;

                        resolve(data);
                    })
                    .catch(errorHandler)
            }
        });

    }

    async getList(_list, type = "full", directSuperGroups, _params = {}) {
        /*
        _params could be sth. like this:
            {
                "page": 5,
                "entries-per-page": 200,
                "object-type": "ADDRESS",
                "min-permission": 32
                "fields": "GGUID,NAME,CHRISTIANNAME, ... "
            }
        */
        let me = this,
            list = _list && _list.includes('suggested') ? 'suggestedValues' : _list,

            res = [],
            supergroups = directSuperGroups && typeof directSuperGroups === 'string' ? directSuperGroups.replace(' ', ' ').replace(', ', ',').replace(' ,', ',').split(',') : null,
            // @ts-ignore
            groupIds = me.groups && supergroups ? JSON.search(me.groups, `//*[${supergroups.map(item => `DISPLAYNAME="${item}"`).join(' or ')}]/GGUID`) : [],

            params = {
                "entries-per-page": 1000,
                ..._params
            },

            paramsString = '';

        if (_params) {
            if (_params.hasOwnProperty("object-type")) {
                params = {
                    // @ts-ignore
                    "min-permission": 16,
                    ...params
                }
            }

            paramsString += Object.keys(params).map((key) => {
                return `${key}=${params[key]}`
            }).join("&");
        }


        // @ts-ignore
        if (directSuperGroups && list !== 'group' && list.toLowerCase() !== 'suggestedvalues' && !me.groups) {
            // @ts-ignore
            me.groups = await me.getList('group');

            // @ts-ignore
            groupIds = JSON.search(me.groups, `//*[${supergroups.map(item => `DISPLAYNAME="${item}"`).join(' or ')}]/GGUID`);
        }


        return new Promise(resolve => {

            if (list && list.toLowerCase() === 'suggestedvalues') {
                me.getSchema(type).then(schema => {
                    let field = directSuperGroups,
                        vals = schema[field].suggestedValues;

                    if (!vals) {
                        if (field === 'GWSSTATUS')
                            field = 'GWSTYPE'
                        // @ts-ignore
                        vals = me.unique(JSON.search(schema[field], `//${_list}/value`));
                    }

                    console.log(`Eigabehilfen: ${JSON.stringify(vals)}`);

                    resolve(vals);
                });

            } else if (!paramsString) {
                me.api.fetch(`${me.version}/${list}/${type}${paramsString}`)
                    .then(function (resp) {
                        if (!resp.ok) {
                            return resp.text().then(function (text) {
                                throw Error(resp.statusText + "<br>" + text);
                            });
                        }

                        return (resp.json());
                    }).then(function (json) {
                        ////debugger;
                        if (supergroups && supergroups.length && list !== 'group') {
                            for (let i = 0, len = json.length; i < len; i++) {
                                let entry = json[i],
                                    directSuperGroups = entry.directSuperGroups;

                                if (directSuperGroups.some(v => groupIds.includes(v))) {

                                    res.push(
                                        {
                                            directSuperGroups: directSuperGroups,
                                            self: entry.links.self,
                                            id: entry.id,

                                            ...entry.fields
                                        }
                                    );
                                }
                            }
                            resolve(res);
                        } else {
                            resolve(json);
                        }
                    }).catch(errorHandler);
            } else {
                let resArr = [],
                    currentPage = 1,
                    pageSize = params["entries-per-page"];

                function callFn() {
                    //listview.links.viewdata + '?page=' + currentPage + '&entries-per-page=' + pageSize + '&fields=' + availableFields.join(','),
                    me.api.fetch(`${me.version}/${list}/${type}?page=${currentPage}&${paramsString}`)
                        .then(function (resp) {

                            if (!resp.ok) {
                                // @ts-ignore
                                reject(resp);
                                resp.text().then(function (text) {
                                    throw Error(resp.statusText + "<br>" + text);
                                });

                            } else if (resp.ok) {
                                return resp.json();
                            }

                        }).then((json) => {
                            let JSONresult = json;

                            JSONresult = json ? json : null;

                            if (JSONresult)
                                resArr = [...resArr, ...JSONresult];

                            if (JSONresult && JSONresult.length === Number(pageSize)) {
                                console.log(JSONresult.length + ' Datensätze geladen');
                                ++currentPage;

                                callFn.apply(this, arguments);

                            } else {
                                console.log(`ALLE ${resArr.length} DATENSÄTZE GELADEN!!!`);
                                //console.table(resArr);

                                if (json && json.length || resArr && resArr.length)
                                    json = resArr;

                                resolve(json ? json : []);
                            }

                        }).catch(errorHandler);
                };
                callFn();
            }
        });

    }


}
