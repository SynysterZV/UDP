import dgram, { Socket } from "dgram"
import net, { Socket as NetSocket, Server } from "net"
import { prompt } from "inquirer";
import { Signale } from "signale";

interface Init {
    ip?: string
    port?: number
    type?: "TCP" | "UDP"
}

class Client {

    public cache: Map<string, string[]>
    public client: Socket | NetSocket | Server | null
    public logger: Signale<'listening' | 'received'>

    public port: number
    public ip: string
    public type: "TCP" | "UDP"

    constructor() {
        this.cache = new Map()
        this.client = null

        this.port = 8080
        this.ip = ''
        this.type = "UDP"

        this.logger = new Signale({
            scope: 'UNK',
            types: {
                listening: {
                    badge: '✓',
                    label: "LISTENING",
                    color: 'green'
                },
                received: {
                    badge: '→',
                    label: 'RECEIVED',
                    color: 'yellow'
                }
            }
        })

    }

    async getIP() {
        return (await prompt([
            {
                name: 'ip',
                type: 'input',
                message: 'IP address:',
                default: 'localhost',
            }
        ])).ip
    }

    async log(addr: string, d: Buffer) {
        console.clear()

        let cache = this.cache.get(addr)

        if (!cache) {
            cache = this.cache.set(addr, []).get(addr)
        }

        this.cache.set(addr, [...cache!, d.toString()])

        for(let [k,v] of this.cache) {
            this.logger
                .scope(k)
                .received(v)
        }
    }

    async startUDP(port = this.port) {

        this.ip = await this.getIP()

        this.client = dgram.createSocket('udp4')

        this.client
            .on('listening', () => this.logger.scope(this.ip).listening(`Server listening on port ${this.port}\n`))
            .on('message', (d,r) => {
                console.clear()
                let cache = this.cache.get(r.address)

                if (!cache) {
                    cache = this.cache.set(r.address, []).get(r.address)
                }

                this.cache.set(r.address, [...cache!, d.toString()])

                for(let [k,v] of this.cache) {
                    this.logger
                        .scope(k)
                        .received(v)
                }
            })
            .on('error', e => {
                (this.client as Socket).close()
                this.startUDP(port + 1)
            })
            .bind(port)
            
        this.sendLoop()
    }

    async startTCP(port = this.port) {
        let { type } = await prompt([
            {
                name: 'type',
                type: 'list',
                choices: ['Server', 'Client']
            }
        ])

        switch(type) {
            case "Server":
                this.client = net.createServer(c => {
                    this.TCPSendLoop(c)

                    c
                    .on("data", (d) => {
                        this.log(c.remoteAddress!, d)
                    })
                    .on('error', this.logger.error)
                })
                    .listen(port, () => this.logger.listening(`TCP Server listening on port ${port}`))

                break;
            
            case "Client":

                this.ip = await this.getIP()

                this.client = net.connect({ host: this.ip, port: this.port }, () => {
                    this.TCPSendLoop(this.client as NetSocket)
                })

                    .on("data", (d) => {
                        this.log((this.client as NetSocket).remoteAddress!, d)
                    })
                    .on('error', this.logger.error)
        }

        
    }

    async TCPSendLoop(c: NetSocket) {

        const { input } = await prompt([
            {
                name: 'input',
                type: 'input',
                message: 'Input:'
            }
        ])

        c.write(input)

        this.TCPSendLoop(c)
    }

    async sendLoop() {
        
        const { input } = await prompt([
            {
                name: 'input',
                type: 'input',
                message: 'Input:'
            }
        ])

        ;(this.client as Socket).send(input, this.port, this.ip)
        this.sendLoop()
    }

    async init({ port, type }: Init) {

        if (!type) {
            this.type = (await prompt([
                {
                    name: 'type',
                    type: 'list',
                    message: 'TCP or UDP?',
                    choices: ['TCP', 'UDP']
                }
            ])).type
        }

        if (!port) {
            this.port = (await prompt([
                {
                    name: 'port',
                    type: 'number',
                    message: 'Port Number:',
                    default: 8080,
                }
            ])).port
        }

        this.type == 'UDP'
        ? this.startUDP()
        : this.startTCP()
    }
}

new Client().init({})