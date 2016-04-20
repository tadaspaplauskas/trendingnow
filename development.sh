forever stopall
NODE_ENV=development forever start -a --uid "app" app.js
cpulimit -l 10 NODE_ENV=development forever start -a --uid "services" services.js