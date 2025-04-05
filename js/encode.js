const random = require("random");
const math = require("mathjs"); // Thư viện math.js để xử lý ma trận

class Encode {
    constructor(
        numMachines,
        numJobs,
        numOperations,
        numOperationsPerJob,
        availMachines,
        availWorkers,
        lotSizes,
        lambdaThreshold,
        minSublotSize,
        beta
    ) {
        this.numMachines = numMachines;
        this.numJobs = numJobs;
        this.numOperations = numOperations;
        this.numOperationsPerJob = numOperationsPerJob;
        this.availMachines = availMachines;
        this.availWorkers = availWorkers;
        this.lotSizes = lotSizes;
        this.lambdaThreshold = lambdaThreshold;
        this.minSublotSize = minSublotSize;
        this.beta = beta;
    }

    initPos() {
        // Khởi tạo ma trận đầu tiên
        const firstMatrix = Array.from({ length: this.numMachines }, () =>
            Array(this.numOperations).fill(0)
        );
        let secondMatrix = [];

        let opIndex = 0;

        // Xử lý từng công việc
        for (let jobIndex = 0; jobIndex < this.numJobs; jobIndex++) {
            const lotSize = this.lotSizes[jobIndex];

            for (let i = 0; i < this.numOperationsPerJob[jobIndex]; i++) {
                let machines = [...this.availMachines[opIndex]];
                let tms = machines.length;

                if (tms === 1) {
                    const machine = machines[0];
                    firstMatrix[machine - 1][opIndex] = lotSize;
                } else {
                    const randomNum = Math.random();
                    if (randomNum < this.lambdaThreshold) {
                        const machine =
                            machines[
                                Math.floor(Math.random() * machines.length)
                            ];
                        firstMatrix[machine - 1][opIndex] = lotSize;
                    } else {
                        let remainingLotSize = lotSize;
                        let aijk = random.int(
                            this.minSublotSize,
                            remainingLotSize - this.minSublotSize
                        );
                        let machine =
                            machines[
                                Math.floor(Math.random() * machines.length)
                            ];
                        firstMatrix[machine - 1][opIndex] = aijk;
                        remainingLotSize -= aijk;
                        machines = machines.filter((m) => m !== machine);

                        tms--;
                        while (
                            tms > 2 &&
                            remainingLotSize >= this.minSublotSize * 2
                        ) {
                            const mui = random.int(
                                this.minSublotSize,
                                remainingLotSize - this.minSublotSize
                            );
                            machine =
                                machines[
                                    Math.floor(Math.random() * machines.length)
                                ];
                            firstMatrix[machine - 1][opIndex] = mui;
                            remainingLotSize -= mui;
                            machines = machines.filter((m) => m !== machine);
                            tms--;
                        }

                        const lastMachine = machines[machines.length - 1];
                        firstMatrix[lastMachine - 1][opIndex] =
                            remainingLotSize;
                    }
                }

                opIndex++;
            }
        }

        // Tạo danh sách công việc
        const jobList = [];
        opIndex = 0;
        for (let jobIndex = 0; jobIndex < this.numJobs; jobIndex++) {
            for (let i = 0; i < this.numOperationsPerJob[jobIndex]; i++) {
                jobList.push(
                    ...Array(this.availMachines[opIndex].length).fill(
                        jobIndex + 1
                    )
                );
                opIndex++;
            }
        }
        jobList.sort(() => Math.random() - 0.5); // Shuffle danh sách công việc

        // Tạo danh sách máy móc và công nhân
        const machineList = [];
        const workerList = [];
        for (let opIndex = 0; opIndex < this.numOperations; opIndex++) {
            let machines = [...this.availMachines[opIndex]];
            for (let i = 0; i < this.availMachines[opIndex].length; i++) {
                const machine =
                    machines[Math.floor(Math.random() * machines.length)];
                machineList.push(machine);
                const availWorkers = this.availWorkers[opIndex][machine - 1];
                const worker =
                    availWorkers[
                        Math.floor(Math.random() * availWorkers.length)
                    ];
                workerList.push(worker);
                machines = machines.filter((m) => m !== machine);
            }
        }

        // Kết hợp thành ma trận thứ hai
        secondMatrix = [jobList, machineList, workerList];

        return { firstMatrix, secondMatrix };
    }
}

module.exports = Encode;
