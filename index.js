const app = new Tether({
    el: '#app',
    
    components: [],

    data: {
        first_name: 'Josh',
    },

    mounted() {
        console.log(`We're ready to play!`)
    },
    
    methods: {
        submit() {
            console.log('Form was submitted:', this.data.first_name);
        }
    }
});

app.mount();