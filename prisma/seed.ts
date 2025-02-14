import {PrismaClient} from '@prisma/client'
import assistantModeSeed from './data/assistant-mode.json'
import llmProviderSeed from './data/llm-provider.json'


const prisma = new PrismaClient()

async function main() {
    await prisma.assistantMode.createMany({
        data: assistantModeSeed,
        skipDuplicates: true
    });

    await prisma.lLMProvider.createMany({
        data: llmProviderSeed,
        skipDuplicates: true
    });
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
