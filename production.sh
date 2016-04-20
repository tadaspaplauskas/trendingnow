forever stopall
NODE_ENV=production forever start -a --uid "app" app.js
NODE_ENV=production forever start -a --uid "services" services.js