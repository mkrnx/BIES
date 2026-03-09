const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log("Projects:", await prisma.project.findMany());
}
main();
