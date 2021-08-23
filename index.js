const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')
const { prompt } = require('inquirer')
const { Signale } = require('signale')
const dgram = require('dgram');

const signale = new Signale({
    scope: 'UDP',
    types: {
        listening: {
            badge: '✓',
            label: 'LISTENING',
            color: 'green'
        },
        received: {
            badge: '→',
            label: 'RECEIVED',
            color: 'yellow'
        }
    }
})

class UDP {
    constructor({ ip, port, type }) {
        this.sends = []
        type.toLowerCase() == 'server' ? this.startServer(port) : this.startClient(ip, port)
    }

    async startServer(port) {
        const socket = dgram.createSocket('udp4')

        if(!port) {
            port = (await prompt([
                {
                    name: 'port',
                    type: 'number',
                    message: 'Port Number:',
                    default: 8080,
                    validate(i) {
                        let done = this.async()
                        if(i < 1024 || i > 65525) return done('You need to provide a valid port (1024-65535)')
                        else done(null, true)
                    }
                }
            ])).port
        }

        socket
        .on('listening', () => { console.clear(); signale.listening(`Server listening on port ${port}\n`) })
        .on('message', (d,r) => {
            signale
            .scope(r.address)
            .received(d.toString())

            socket.send(d.toString(), r.port, r.address)
        })
        .bind(port)
    }

    async startClient(ip, port) {

        this.client = dgram.createSocket('udp4')

        if(!ip || !port) {
            const a = await prompt([
                {
                    name: 'ip',
                    type: 'input',
                    message: 'IP address:',
                    default: 'localhost',
                    validate(i) {
                        let done = this.async()
                        if(!i.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|localhost/)) return done('You need to provide a valid ip')
                        else done(null, true)
                    }
                },
                {
                    name: 'port',
                    type: 'number',
                    message: 'Port Number:',
                    default: 8080,
                    validate(i) {
                        let done = this.async()
                        if(i < 1024 || i > 65525) return done('You need to provide a valid port (1024-65535)')
                        else done(null, true)
                    }
                }
            ])

            port = a.port
            ip = a.ip
        }

        this.port = port
        this.ip = ip

        this.client.bind(this.port + 1, () => this.client.setBroadcast(true))
        this.client.on('message', i => this.sends.push(i.toString()) )
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
        this.sends.forEach(i => signale.received(i) )
        this.sendLoop()
    }
}

const args = yargs(hideBin(process.argv))
    .command('server [port]', 'start the server', yargs => {
        return yargs
            .positional('port', {
                describe: 'port to bind on',
                default: 8080
            })
    }, argv => {
        new UDP({ port: argv.port, type: 'server' })
    })
    .command('client [ip] [port]', 'Start as client', yargs => {
        return yargs
            .positional('ip', {
                describe: 'ip to send to',
                default: '127.0.0.1'
            })
            .positional('port', {
                describe: 'port to send to',
                default: 8080
            })
    }, argv => {
        new UDP({ ip: argv.ip, port: argv.port, type: 'client' })
    })
    .argv

if(!args._.length) {
    prompt([
        {
            name: 'type',
            type: 'list',
            message: 'Client or Server?',
            choices: ['Client', 'Server']
        }
    ]).then(({ type }) => {
        new UDP({ type })
    })
}