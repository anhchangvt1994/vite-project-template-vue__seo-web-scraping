'use strict'
function _interopRequireDefault(obj) {
	return obj && obj.__esModule ? obj : { default: obj }
}
function _nullishCoalesce(lhs, rhsFn) {
	if (lhs != null) {
		return lhs
	} else {
		return rhsFn()
	}
}
function _optionalChain(ops) {
	let lastAccessLHS = undefined
	let value = ops[0]
	let i = 1
	while (i < ops.length) {
		const op = ops[i]
		const fn = ops[i + 1]
		i += 2
		if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) {
			return undefined
		}
		if (op === 'access' || op === 'optionalAccess') {
			lastAccessLHS = value
			value = fn(value)
		} else if (op === 'call' || op === 'optionalCall') {
			value = fn((...args) => value.call(lastAccessLHS, ...args))
			lastAccessLHS = undefined
		}
	}
	return value
}
var _child_process = require('child_process')
var _chokidar = require('chokidar')
var _chokidar2 = _interopRequireDefault(_chokidar)
var _cors = require('cors')
var _cors2 = _interopRequireDefault(_cors)
var _fastify = require('fastify')
var _fastify2 = _interopRequireDefault(_fastify)
var _middie = require('@fastify/middie')
var _middie2 = _interopRequireDefault(_middie)
var _servestatic = require('serve-static')
var _servestatic2 = _interopRequireDefault(_servestatic)
var _path = require('path')
var _path2 = _interopRequireDefault(_path)
var _PortHandler = require('../../config/utils/PortHandler')
var _constants = require('./constants')
var _indexfastify = require('./puppeteer-ssr/index.fastify')
var _indexfastify2 = _interopRequireDefault(_indexfastify)
var _ConsoleHandler = require('./utils/ConsoleHandler')
var _ConsoleHandler2 = _interopRequireDefault(_ConsoleHandler)
var _DetectBot = require('./utils/DetectBot')
var _DetectBot2 = _interopRequireDefault(_DetectBot)
var _DetectDevice = require('./utils/DetectDevice')
var _DetectDevice2 = _interopRequireDefault(_DetectDevice)
var _DetectStaticExtension = require('./utils/DetectStaticExtension')
var _DetectStaticExtension2 = _interopRequireDefault(_DetectStaticExtension)
var _DetectRedirect = require('./utils/DetectRedirect')
var _DetectRedirect2 = _interopRequireDefault(_DetectRedirect)
var _SendFile = require('./utils/SendFile')
var _SendFile2 = _interopRequireDefault(_SendFile)
var _constants3 = require('./puppeteer-ssr/constants')
var _CookieHandler = require('./utils/CookieHandler')
var _DetectLocale = require('./utils/DetectLocale')
var _DetectLocale2 = _interopRequireDefault(_DetectLocale)
var _serverconfig = require('./server.config')
var _serverconfig2 = _interopRequireDefault(_serverconfig)

const COOKIE_EXPIRED_SECOND = _constants3.COOKIE_EXPIRED / 1000

require('events').EventEmitter.setMaxListeners(200)

const cleanResourceWithCondition = async () => {
	if (process.env.ENV === 'development') {
		// NOTE - Clean Browsers and Pages after start / restart
		const {
			deleteResource,
		} = require('./puppeteer-ssr/utils/FollowResource.worker/utils.ts')
		const browsersPath = _path2.default.resolve(
			__dirname,
			'./puppeteer-ssr/browsers'
		)

		return Promise.all([
			deleteResource(browsersPath),
			deleteResource(_constants.pagesPath),
		])
	}
}

const startServer = async () => {
	await cleanResourceWithCondition()
	let port = _PortHandler.getPort.call(void 0, 'PUPPETEER_SSR_PORT')
	port = await _PortHandler.findFreePort.call(
		void 0,
		port || process.env.PUPPETEER_SSR_PORT || 8080
	)
	_PortHandler.setPort.call(void 0, port, 'PUPPETEER_SSR_PORT')

	const app = _fastify2.default.call(void 0)

	await app.register(_middie2.default, {
		hook: 'onRequest', // default
	})

	app
		.use(_cors2.default.call(void 0))
		.use(
			'/robots.txt',
			_servestatic2.default.call(
				void 0,
				_path2.default.resolve(__dirname, '../robots.txt')
			)
		)
		.use(async function (req, res, next) {
			const isStatic = _DetectStaticExtension2.default.call(void 0, req)
			/**
			 * NOTE
			 * Cache-Control max-age is 1 year
			 * calc by using:
			 * https://www.inchcalculator.com/convert/month-to-second/
			 */

			if (isStatic) {
				const filePath = _path2.default.resolve(
					__dirname,
					`../../dist/${req.url}`
				)

				if (_constants.ENV !== 'development') {
					res.setHeader('Cache-Control', 'public, max-age=31556952')
				}

				_SendFile2.default.call(void 0, filePath, res)
			} else {
				next()
			}
		})
		.use(function (req, res, next) {
			if (!process.env.BASE_URL)
				process.env.BASE_URL = `${req.protocol}://${req.hostname}`
			next()
		})
		.use(function (req, res, next) {
			let botInfo
			if (req.headers.service === 'puppeteer') {
				botInfo = req.headers['bot_info'] || ''
			} else {
				botInfo = JSON.stringify(_DetectBot2.default.call(void 0, req))
			}

			_CookieHandler.setCookie.call(
				void 0,
				res,
				`BotInfo=${botInfo};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)
			next()
		})
		.use(function (req, res, next) {
			const localeInfo = _DetectLocale2.default.call(void 0, req)
			const enableLocale =
				_serverconfig2.default.locale.enable &&
				Boolean(
					!_serverconfig2.default.locale.routes ||
						!_serverconfig2.default.locale.routes[req.url] ||
						_serverconfig2.default.locale.routes[req.url].enable
				)

			_CookieHandler.setCookie.call(
				void 0,
				res,
				`LocaleInfo=${JSON.stringify(
					localeInfo
				)};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)

			if (enableLocale) {
				_CookieHandler.setCookie.call(
					void 0,
					res,
					`lang=${_nullishCoalesce(
						_optionalChain([
							localeInfo,
							'optionalAccess',
							(_) => _.langSelected,
						]),
						() => _serverconfig2.default.locale.defaultLang
					)};Path=/`
				)

				if (_serverconfig2.default.locale.defaultCountry) {
					_CookieHandler.setCookie.call(
						void 0,
						res,
						`country=${_nullishCoalesce(
							_optionalChain([
								localeInfo,
								'optionalAccess',
								(_2) => _2.countrySelected,
							]),
							() => _serverconfig2.default.locale.defaultCountry
						)};Path=/`
					)
				}
			}
			next()
		})
		.use(function (req, res, next) {
			const redirectInfo = _DetectRedirect2.default.call(void 0, req, res)

			if (redirectInfo.statusCode !== 200) {
				if (req.headers.accept === 'application/json') {
					res
						.setHeader('Cache-Control', 'no-store')
						.end(JSON.stringify(redirectInfo))
				} else {
					if (redirectInfo.redirectUrl.length > 1)
						redirectInfo.redirectUrl = redirectInfo.redirectUrl.replace(
							/\/$|\/(\?)/,
							'$1'
						)
					res.writeHead(redirectInfo.statusCode, {
						Location: redirectInfo.redirectUrl,
						'cache-control': 'no-store',
					})
					res.end()
				}
			} else next()
		})
		.use(function (req, res, next) {
			let deviceInfo
			if (req.headers.service === 'puppeteer') {
				deviceInfo = req.headers['device_info'] || ''
			} else {
				deviceInfo = JSON.stringify(_DetectDevice2.default.call(void 0, req))
			}

			_CookieHandler.setCookie.call(
				void 0,
				res,
				`DeviceInfo=${deviceInfo};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)
			next()
		})
	;(await _indexfastify2.default).init(app)

	app.listen(
		{
			port,
		},
		() => {
			_ConsoleHandler2.default.log('Server started. Press Ctrl+C to quit')
			_optionalChain([
				process,
				'access',
				(_3) => _3.send,
				'optionalCall',
				(_4) => _4('ready'),
			])
		}
	)

	process.on('SIGINT', async function () {
		await app.close()
		process.exit(0)
	})

	if (process.env.ENV === 'development') {
		// NOTE - restart server onchange
		const watcher = _chokidar2.default.watch(
			[_path2.default.resolve(__dirname, './**/*.ts')],
			{
				ignored: /$^/,
				persistent: true,
			}
		)

		watcher.on('change', async (path) => {
			_ConsoleHandler2.default.log(`File ${path} has been changed`)
			await app.close()
			setTimeout(() => {
				_child_process.spawn.call(
					void 0,
					'node',
					['--require', 'sucrase/register', 'server/src/index.ts'],
					{
						stdio: 'inherit',
						shell: true,
					}
				)
			})
			process.exit(0)
		})
	}
}

startServer()