// Mantém o comando antigo como entrada para o perfil dedicado local.
process.argv.splice(2, 0, "login");
require("./local/runner");
