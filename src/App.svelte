<script>
    import { onMount } from 'svelte';

    import { PivotTableUI } from 'svelte-pivottable';

    import "@smartdesign/styles/dist/styles.css";
    import "@smartdesign/styles/dist/theme.css";
    import "@smartdesign/group";

    import { CASHelper } from "./js/CASHelper.js";
    import mockup from "./mockup.json"

    let CASConnector = new CASHelper();
    globalThis.CASConnector = CASConnector;

    const urlParams = new URLSearchParams(window.location.search);
    const hasGGUID = urlParams.has("gguid");

    $: editMode = location.port === "8080" ? true : false;
    $: disabled = !editMode;

    let ref = null,
        caption,
        user;

    const dateOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    let substrate, // Substrate are for column names;
        columnNames,
        tagebuecher
    ;

    // Aggregator-Funktion für die Summierung
    const aggregators = {
        'kaaaboooommmm': () => () => ({
            sum: 0,
            push: function (record) {
            this.sum += record.value;
            },
            value: function () {
            return this.sum;
            },
            format: function (x) {
            return x.toString();
            },
        }),
    }

    // see documenation for supported options
    const options = {
        rows:["Jahr", "Datum"],
        cols:["Substrat"],
        locale: "de",
        aggregatorName:"Sum",
        vals:["Menge"],
        rendererName: "Table"
    };

    // see documentation for supported input formats
    $: result = [];//mockup
    $: data = transformJson( result );
    $:console.log(data);

    function transformJson(inputJson) {
        return inputJson.flatMap(entry => {
            const datum = new Date(entry.OKEY).toLocaleDateString('de-DE', {
                month: 'long'
            }),
            jahr = new Date(entry.OKEY).toLocaleDateString('de-DE', {
                year: 'numeric'
            }),
            day = new Date(entry.OKEY).toLocaleDateString('de-DE', {
                day: '2-digit'
            });

            return entry.messungen.map(messung => ({
                Datum: datum,
                Jahr: jahr,
                Tag: day,
                Substrat: messung.KEYWORD,
                Menge: messung.GID_WERT,
                Einheit: messung.GID_EINHEIT
            }));
        });
    }

    const getData = async() =>{
        return new Promise(async (resolve, reject)=>{
            substrate = await CASConnector.query("GID_SUBSTRATE", undefined, undefined, undefined,{params: `SELECT DISTINCT sub.GGUID as OGGUID, sub.KEYWORD as OKEY FROM GID_SUBSTRATE AS sub WHERE sub.IsLinkedToWhere(ANLAGEN as a :WHERE a.GGUID = 0x${globalThis.gguid})`}).then(res=>res?.rows??[])
            tagebuecher  = await CASConnector.query("BETRIEBSTAGEBUCH", undefined, undefined, undefined,{params: `SELECT DISTINCT sub.GGUID as OGGUID, sub.DATUM as OKEY FROM BETRIEBSTAGEBUCH AS sub WHERE sub.IsLinkedToWhere(ANLAGEN as a :WHERE a.GGUID = 0x${globalThis.gguid})`}).then(res=>res?.rows??[])
            columnNames = substrate?.map(e=>e.OKEY)?.sort();

            if(tagebuecher && Array.isArray(tagebuecher)){
                for (const diary of tagebuecher) {
                    debugger;
                    let messungen = await CASConnector.query('MESSUNG', undefined, undefined, undefined,{params: `SELECT DISTINCT me.GGUID as MGGUID,me.GID_WERT, me.GID_EINHEIT FROM MESSUNG AS me WHERE me.IsLinkedToWhere(BETRIEBSTAGEBUCH as d :WHERE d.GGUID = 0x${diary.OGGUID})`}).then(res=>res?.rows??[]);

                    delete diary.OGGUID

                    for (let messung of messungen) {
                        debugger;
                        let substrat = await CASConnector.query("GID_SUBSTRATE", undefined, undefined, undefined,{params: `SELECT DISTINCT me.KEYWORD FROM GID_SUBSTRATE AS me WHERE me.IsLinkedToWhere(MESSUNG as d :WHERE d.GGUID = 0x${messung.MGGUID})`}).then(res=>res?.rows?.[0]??[]);

                        delete messung.MGGUID;
                        messung.KEYWORD = substrat.KEYWORD;
                    }

                    diary.messungen = messungen;
                }
            }

            if(tagebuecher?.length)
                result = tagebuecher;

            resolve(result??[]);
        });

    }

    $:isHidden = false;

    function toggleDisplay() {
        isHidden = !isHidden;

        // Wählen Sie alle Elemente mit den Klassen aus und schalten Sie sie um
        const elements = document.querySelectorAll('.pvtAxisContainer, .pvtVals, .pvtRenderers');
        console.log({elements})
        elements.forEach(el => {
            if (isHidden) {
            // @ts-ignore
            el.style.display = 'none';
            } else {
            // @ts-ignore
            el.style.display = 'table-cell'; // Entfernt die display-Eigenschaft, sodass die Standard-CSS-Stile übernehmen
            }
        });
    }

    onMount(async () => {
        user =
            location.port === "8080"
                ? {}
                : CASConnector.connect().then(async (res) => {
                      const primaryDataObject =
                          CASConnector?.api?.Context?.primaryDataObject;
                      let _state = CASConnector?.api?.State,
                          state = _state?.current;

                      editMode = state?.editMode;
                      ref = state?.ref;
                      caption = state?.caption ?? ref?.label ?? "Pivot-Tabelle";

                      let gguid = (globalThis.gguid = primaryDataObject?.id);
                      let object = (globalThis.object =
                          primaryDataObject?.objectTypeName);

                      if (!gguid || !object) {
                          let splits = CASConnector.hash.split("/");

                          object = globalThis.object = splits[1]?.toUpperCase();
                          gguid = globalThis.gguid = splits[2];
                      }

                      if (_state.onChangeSupported) {
                          _state.onChange((state) => {
                              console.log({ newValue: state.ref.value });

                              // for update in view-Mode
                              if (!editMode) {
                              }
                          });
                      } else {
                          console.error("Method 'onChange' is not supported.");
                      }

                      globalThis.CASConnector = CASConnector;

                      await getData();
                      return CASConnector.user;
                  });

        toggleDisplay();
    });

    let inputElem;
</script>

<main class="container bg-white w-full h-full" id="firstCon" >
    {#await user}
        <sd-group>
            <div
                style="text-align: left; flex: 1; padding-bottom: 0px;"
                class="sd-content-heading"
            >
                Daten werden geladen
            </div>
        </sd-group>
    {:then result}
        <!--
        <sd-group>
        -->
        {#if !data?.length}
            <sd-group>
                <div
                    style="text-align: left; flex: 1; padding-bottom: 0px;"
                    class="sd-content-heading"
                >Es sind keine Daten vorhanden {data?.length}</div>
            </sd-group>
        {:else}
            <h1 style="text-align: left; flex: 1; margin: 0px; padding-bottom: 0px;" class="sd-content-heading" > {caption} </h1>

            <div class="gidToggle hover:border-none flex h-11 items-center">
                <label
                    class="sd-primary-text mr-4 inline-block pl-[0.15rem] hover:cursor-pointer"
                    for={inputElem} >Zeige Elemente
                </label>

                <input bind:this={inputElem}
                    class="mr-2 mt-[0.3rem] h-3.5 w-8 appearance-none rounded-[0.4375rem] bg-neutral-300 before:pointer-events-none before:absolute before:h-3.5 before:w-3.5 before:rounded-full before:bg-transparent before:content-[''] after:absolute after:z-[2] after:-mt-[0.1875rem] after:h-5 after:w-5 after:rounded-full after:border-none after:bg-neutral-100 after:shadow-[0_0px_3px_0_rgb(0_0_0_/_7%),_0_2px_2px_0_rgb(0_0_0_/_4%)] after:transition-[background-color_0.2s,transform_0.2s] after:content-[''] checked:bg-primary checked:after:absolute checked:after:z-[2] checked:after:-mt-[3px] checked:after:ml-[1.0625rem] checked:after:h-5 checked:after:w-5 checked:after:rounded-full checked:after:border-none checked:after:bg-primary checked:after:shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),_0_2px_2px_0_rgba(0,0,0,0.14),_0_1px_5px_0_rgba(0,0,0,0.12)] checked:after:transition-[background-color_0.2s,transform_0.2s] checked:after:content-[''] hover:cursor-pointer focus:outline-none focus:ring-0 focus:before:scale-100 focus:before:opacity-[0.12] focus:before:shadow-[3px_-1px_0px_13px_rgba(0,0,0,0.6)] focus:before:transition-[box-shadow_0.2s,transform_0.2s] focus:after:absolute focus:after:z-[1] focus:after:block focus:after:h-5 focus:after:w-5 focus:after:rounded-full focus:after:content-[''] checked:focus:border-primary checked:focus:bg-primary checked:focus:before:ml-[1.0625rem] checked:focus:before:scale-100 checked:focus:before:shadow-[3px_-1px_0px_13px_#3b71ca] checked:focus:before:transition-[box-shadow_0.2s,transform_0.2s] dark:bg-neutral-600 dark:after:bg-neutral-400 dark:checked:bg-primary dark:checked:after:bg-primary dark:focus:before:shadow-[3px_-1px_0px_13px_rgba(255,255,255,0.4)] dark:checked:focus:before:shadow-[3px_-1px_0px_13px_#3b71ca]"
                    type="checkbox"
                    role="switch"
                    checked={!isHidden}
                    value={Boolean(!isHidden)}
                    on:change={toggleDisplay}
                />
            </div>

            <PivotTableUI {...options} {data}></PivotTableUI>
        {/if}

        <!--
            </sd-group>
        -->
    {:catch error}
        <sd-group>
            <div style="text-align: left; flex: 1; padding-bottom: 0px;" class="sd-content-heading" >Es ist ein Fehler aufgetreten</div>
            <pre>{typeof error === "object" ? JSON.stringify(error) : error}</pre>
            <PivotTableUI {...options} {data} {...aggregators}></PivotTableUI>
        </sd-group>
    {/await}
</main>

<style>
    input[type="checkbox"]:checked {
        background-image: none;
    }
    .checked\:bg-primary:checked {
        background-color: rgb(33 134 235 / var(--tw-bg-opacity));
    }
    .checked\:after\:bg-primary:checked::after {
        background-color: rgb(20 103 186 / var(--tw-bg-opacity));

    }</style>
