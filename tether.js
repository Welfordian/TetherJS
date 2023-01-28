class Tether {
    constructor(config = {}) {
        this.nodes = [];
        this.nodeReferences = {};
        
        this.config = Object.assign({
            el: null,
            data: {},
            template: ``,
            components: [],
            methods: {},
            mounted() {}
        }, config);
        
        this.config.data = this.proxyData();
    }
    
    mount() {
        if (! this.validateConfig()) return;

        this.nodes = this.extractDocumentNodes(this.config.el === null ? this.templateNodes() : document.querySelector(this.config.el).childNodes);
        
        this.nodeReferences = this.convertArrayToObject([...this.nodes].map(node => {
            if (node.nodeType === Node.TEXT_NODE) return;
            
            return {path: this.getPathTo(node), node, text: node.innerText};
        }).filter(node => node !== undefined), 'path');
        
        this.render();
        
        this.config.mounted.bind(this);
        this.config.mounted();
    }
    
    templateNodes() {
        return [];
    }
    
    extractDocumentNodes(nodes) {
        // TODO: Parent nodes need to be marked as such to prevent overwriting the entire content
        
        let traversed = [];
        
        nodes.forEach(node => {
            traversed = [...traversed, node];
            
            if (node.childElementCount > 0) {
                traversed = [...traversed, ...this.extractDocumentNodes(node.childNodes)];
            }
        })
        
        return traversed;
    }
    
    render() {        
        this.nodes.forEach(node => {
            if (node.innerText !== undefined) {
                let innerText = this.nodeReferences[this.getPathTo(node)]?.text;

                this.mapAttributes(node);
                
                if (/{{(.*?)}}/g.test(innerText)) {
                    let matches = innerText.match(/{{(.*?)}}/g);
                    
                    matches.forEach(match => {
                        let strippedMatch = match.replace('{{ ', '').replace(' }}', '');
                        let matchRegex = new RegExp(this.escapeRegExp(match), 'g');

                        if (this.config.data[strippedMatch] !== undefined) {
                            innerText = innerText.replace(matchRegex, this.config.data[strippedMatch]);
                        } else {
                            try {
                                strippedMatch = this.replaceVariablesWithValues(strippedMatch);
                                
                                innerText = innerText.replace(matchRegex, eval(strippedMatch));
                            } catch (err) {
                                innerText = innerText.replace(matchRegex, "");
                            }
                        }
                    });
                    
                    node.innerText = innerText;
                }
            }
        });
    }
    
    mapAttributes(node) {
        if (node.attributes?.hasOwnProperty('@click') ?? false) {
            node.onclick = this.config.methods[node.attributes['@click'].textContent].bind(this.config);
            node.attributes.removeNamedItem('@click');
        }

        if (node.attributes?.hasOwnProperty('@submit') ?? false) {
            node.onsubmit = function (app, attribute) {
                return e => { e.preventDefault(); app.config.methods[attribute].bind(app.config)(); }
            }(this, node.attributes['@submit'].textContent);
            node.attributes.removeNamedItem('@submit');
        }

        if (node.attributes?.hasOwnProperty('value') ?? false) {
            node.value = this.config.data[node.attributes['value'].textContent];
            node.attributes.removeNamedItem('value');
        }
        
        if (node.attributes?.hasOwnProperty(':value') ?? false) {
            node.value = this.config.data[node.attributes[':value'].textContent];
            
            node.onkeydown = function (app, attribute) {
                return e => {
                    setTimeout(() => app.config.data[attribute] = e.target.value, 10);
                }
            }(this, node.attributes[':value'].textContent)
            
            node.attributes.removeNamedItem(':value');
        }
    }
    
    replaceVariablesWithValues(string) {
        Object.keys(this.config.data).forEach(key => {
            let matchRegex = new RegExp(key, 'g');
            
            string = string.replace(matchRegex, this.config.data[key]);
        })
        
        return string;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
    
    proxyData() {
        return new Proxy(this.config.data, {
            set: (target, key, value) => {
                target[key] = value;
                
                this.render();
                
                return true;
            },
        })
    }
    
    validateConfig() {
        let valid = true;
        
        if (! 'el' in this.config) {
            valid = false;
            
            this.logError('el is required to mount.');
        }
        
        if ('el' in this.config && document.querySelector(this.config.el) === null) {
            valid = false;
            
            this.logError('element ' + this.config.el + ' is not present.');
        }
        
        return valid;
    }
    
    logError() {
        console.error('[Tether]:', ...arguments);
    }

    convertArrayToObject (array, key) {
        const initialValue = {};
        return array.reduce((obj, item) => {
            return {
                ...obj,
                [item[key]]: item,
            };
        }, initialValue);
    }

    getPathTo(element) {
        const idx = (sib, name) => sib
            ? idx(sib.previousElementSibling, name||sib.localName) + (sib.localName == name)
            : 1;
        const segs = elm => !elm || elm.nodeType !== 1
            ? ['']
            : elm.id && document.getElementById(elm.id) === elm
                ? [`id("${elm.id}")`]
                : [...segs(elm.parentNode), `${elm.localName.toLowerCase()}[${idx(elm)}]`];
        return segs(element).join('/');
    }
}