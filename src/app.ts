import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as dotenv from 'dotenv';
import { Context, Telegraf } from 'telegraf';

dotenv.config();

enum Status {
	Closed = 'Server is closed',
	Starting = 'Server is starting',
	Ready = 'Server is ready',
	Stopping = 'Server is stopping',
}

let server!: ChildProcessWithoutNullStreams;
let status: Status = Status.Closed;
const bot = new Telegraf(process.env.BOT_TOKEN as string);

bot.command('start', (ctx) => start(ctx));
bot.command(['stop', 'close'], (ctx) => stop(ctx));
bot.command(['status', 'info'], (ctx) => serverStatus(ctx));
bot.command('kill', (ctx) => kill(ctx));
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

function start(ctx: Context) {
	if (isServerAlive()) {
		return ctx.reply('Server is already running');
	}
	server = spawn('java', process.env.SERVER_CONFIG?.split(' ') as string[], { cwd: process.env.WORKING_DIRECTORY as string });

	server.stdout.on('data', (data) => {
		data = data.toString();

		if (data.includes('Done')) {
			status = Status.Ready;
		}

		console.log(data);
	});

	server.stderr.on('data', (data) => {
		console.error(data.toString());
	});

	server.on('exit', (code) => {
		console.log(`Child exited with code ${code}`);
		status = Status.Closed;
	});

	server.on('message', (message) => {
		console.log(message);
	});

	ctx.reply('Starting the server...');
	status = Status.Starting;
}

function stop(ctx: Context) {
	if (!isServerAlive()) {
		return ctx.reply('Server is already closed');
	}

	server.stdin.write('stop\n', (err) => {
		if (err) {
			ctx.reply(err.message.toString());
		} else {
			ctx.reply('Stopping the server...');
			status = Status.Stopping;
		}
	});
}

function serverStatus(ctx: Context) {
	ctx.reply(status);
}

function kill(ctx: Context) {
	if (!isServerAlive()) {
		return ctx.reply('Server is closed');
	}

	server.kill('SIGTERM');
}

function isServerAlive() {
	try {
		server && server.kill(0);
		return false;
	} catch (err) {
		return true;
	}
}
