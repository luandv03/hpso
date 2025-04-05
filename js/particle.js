const { swap, revert, mutation, poxCrossover, spxCrossover } = require("./ga");

class Particle {
    constructor(
        numJobs,
        numOperations,
        numMachines,
        numOperationsPerJob,
        lotSizes,
        hprs,
        availMachines,
        minSublotSize,
        beta,
        encoder,
        decoder
    ) {
        this.numJobs = numJobs;
        this.numOperations = numOperations;
        this.numMachines = numMachines;
        this.numOperationsPerJob = numOperationsPerJob;
        this.lotSizes = lotSizes;
        this.hprs = hprs;
        this.availMachines = availMachines;
        this.minSublotSize = minSublotSize;
        this.beta = beta;
        this.lambdaThreshold = 0.3;
        this.encoder = encoder;
        this.decoder = decoder;

        this.posFirstMatrix = null;
        this.posSecondMatrix = null;

        this.pbestFirstMatrix = null;
        this.pbestSecondMatrix = null;

        this.pbestFitness = null;

        this.initPosition();
    }

    initPosition() {
        const { firstMatrix, secondMatrix } = this.encoder.initPos();
        this.posFirstMatrix = firstMatrix;
        this.posSecondMatrix = secondMatrix;

        this.pbestFirstMatrix = JSON.parse(JSON.stringify(this.posFirstMatrix));
        this.pbestSecondMatrix = JSON.parse(
            JSON.stringify(this.posSecondMatrix)
        );

        this.pbestFitness = this.decoder.decode(
            this.pbestFirstMatrix,
            this.pbestSecondMatrix
        );
    }

    updatePosition(gbestFirstMatrix, gbestSecondMatrix, w, c1, c2) {
        const r1 = Math.random();
        const r2 = Math.random();
        const r3 = Math.random();
        const rMutation2 = Math.random();

        // Mutation step
        if (r1 < w) {
            this.posFirstMatrix = mutation(
                JSON.parse(JSON.stringify(this.posFirstMatrix)),
                this.numJobs,
                this.numMachines,
                this.numOperations,
                this.numOperationsPerJob,
                this.lotSizes,
                this.availMachines,
                this.lambdaThreshold,
                this.minSublotSize,
                this.beta
            );

            if (rMutation2 <= 0.5) {
                this.posSecondMatrix[0] = swap(
                    JSON.parse(JSON.stringify(this.posSecondMatrix[0]))
                );
            } else {
                this.posSecondMatrix[0] = revert(
                    JSON.parse(JSON.stringify(this.posSecondMatrix[0]))
                );
            }
        }

        // Personal best crossover
        if (r2 < c1) {
            this.posFirstMatrix = spxCrossover(
                JSON.parse(JSON.stringify(this.posFirstMatrix)),
                JSON.parse(JSON.stringify(this.pbestFirstMatrix)),
                this.numOperations
            );

            this.posSecondMatrix[0] = poxCrossover(
                JSON.parse(JSON.stringify(this.posSecondMatrix[0])),
                JSON.parse(JSON.stringify(this.pbestSecondMatrix[0])),
                this.numJobs
            );
        }

        // Global best crossover
        if (r3 < c2) {
            this.posFirstMatrix = spxCrossover(
                JSON.parse(JSON.stringify(this.posFirstMatrix)),
                JSON.parse(JSON.stringify(gbestFirstMatrix)),
                this.numOperations
            );

            this.posSecondMatrix[0] = poxCrossover(
                JSON.parse(JSON.stringify(this.posSecondMatrix[0])),
                JSON.parse(JSON.stringify(gbestSecondMatrix[0])),
                this.numJobs
            );
        }

        // Decode and evaluate fitness
        const fitness = this.decoder.decode(
            this.posFirstMatrix,
            this.posSecondMatrix
        );

        // Update personal best if fitness improves
        if (fitness < this.pbestFitness) {
            this.pbestFirstMatrix = JSON.parse(
                JSON.stringify(this.posFirstMatrix)
            );
            this.pbestSecondMatrix = JSON.parse(
                JSON.stringify(this.posSecondMatrix)
            );
            this.pbestFitness = fitness;
        }
    }
}

module.exports = Particle;
