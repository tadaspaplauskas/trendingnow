forever stopall
NODE_ENV=development forever start -a -w --uid "app" app.js
NODE_ENV=development forever start -a -w --uid "services" services.js