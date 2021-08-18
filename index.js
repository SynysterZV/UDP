const { prompt } = require('inquirer')
const dgram = require('dgram');

prompt([
    {
        name: 'cors',
        type: 'list',
        message: 'Client or Server?',
        choices: ['Client', 'Server']
    }
]).then(({ cors }) => {
    new UDP(cors)
})

class UDP {
    constructor(type) {
        this.sends = ''
        type == 'Server' ? this.startServer() : this.startClient()
    }

    async startServer() {
        const socket = dgram.createSocket('udp4')

        const { port } = await prompt([
            {
                name: 'port',
                type: 'number',
                message: 'Port Number:'
            }
        ])

        socket
        .on('listening', () => console.log(`Server listening on port ${port}`))
        .on('message', (d,r) => {
            const i = `Recieved: ${d.toString()}\n`
            console.log(`[${r.address}] ${i}`)

            socket.send(i, r.port, r.address)
        })
        .bind(port)
    }

    async startClient() {

        this.client = dgram.createSocket('udp4')

        const { ip, port } = await prompt([
            {
                name: 'ip',
                type: 'input',
                message: 'IP address:'
            },
            {
                name: 'port',
                type: 'number',
                message: 'Port Number:'
            }
        ])

        this.port = port
        this.ip = ip

        this.client.bind(this.port + 1, () => this.client.setBroadcast(true))
        this.client.on('message', i => this.sends += i)
        this.client.on('error', console.log)

        this.sendLoop()
    }

    async sendLoop() {
        const { input } = await prompt([
            {
                name: 'input',
                type: 'input',
                message: 'Input:'
            }
        ])

        this.client.send(input, this.port, this.ip)

        console.clear()
        console.log(this.sends)
        this.sendLoop()
    }
}