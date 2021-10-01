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

    public sendPort: number
    public ip: string
    public type: "TCP" | "UDP"

    constructor() {
        this.cache = new Map()
        this.client = null

        this.sendPort = 8080
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

    async getSendPort() {
        return (await prompt([
            {
                name: 'port',
                type: 'number',
                message: 'Send Port Number:',
                default: 8080,
            }
        ])).port
    }

    async getListenPort() {
        return (await prompt([
            {
                name: 'port',
                type: 'number',
                message: 'Listen Port Number:',
                default: 8080,
            }
        ])).port
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

    async startUDP() {

        const port = await this.getListenPort()
        const sendPort = await this.getSendPort()

        if(!this.ip) this.ip = await this.getIP() 

        this.client = dgram.createSocket('udp4')

        this.client
            .on('listening', () => {
                this.logger.scope(this.ip).listening(`Server listening on port ${port}\n`)
                this.sendLoop(sendPort)
            })
            .on('message', (d,r) => {
                this.log(r.address, d)
            })
            .bind(port)
    }

    async startTCP() {
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
                    // @ts-ignore
                    .listen(() => this.logger.listening(`Server started on port ${this.client?.address().port}`))

                break;
            
            case "Client":

                const port = await this.getSendPort()
                this.ip = await this.getIP()
                

                this.client = net.connect({ host: this.ip, port }, () => {
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

    async sendLoop(port: number) {
        
        const { input } = await prompt([
            {
                name: 'input',
                type: 'input',
                message: 'Input:'
            }
        ])

        ;(this.client as Socket).send(input, port, this.ip)
        this.sendLoop(port)
    }

    async init() {

        this.type = (await prompt([
            {
                name: 'type',
                type: 'list',
                message: 'TCP or UDP?',
                choices: ['TCP', 'UDP']
            }
        ])).type


        this.type == 'UDP'
        ? this.startUDP()
        : this.startTCP()
    }
}

new Client().init()