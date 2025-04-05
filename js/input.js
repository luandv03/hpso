const { DateTime } = require("luxon"); // Sử dụng Luxon để xử lý ngày giờ

function parseDate(dateStr, hours) {
    const dateFormat = "dd-MM-yyyy";
    const originalDate = DateTime.fromFormat(dateStr, dateFormat);
    return originalDate.plus({ hours });
}

function findWorker(workers, workerId) {
    const worker = workers.find((worker) => worker._id === workerId);
    return worker ? worker.id : null;
}

function input(commands, workers) {
    const newCommands = [];
    const inprogressCommands = [];
    let newCommandCount = 1;
    let numOperations = 0;
    const commandMap = {};
    const machineMap = {};
    const workerMap = {};

    // Xử lý commands
    for (const command of commands) {
        if (command.status === "new") {
            command.id = newCommandCount;
            newCommands.push(command);
            newCommandCount++;
            numOperations += command.operations.length;
            commandMap[command.id] = command.command_id;
        } else if (command.status === "inprogress") {
            inprogressCommands.push(command);
        }
    }

    // Xử lý workers
    let workerCount = 1;
    for (const worker of workers) {
        worker.id = workerCount;
        workerMap[workerCount] = worker.worker_id;
        workerCount++;
    }

    // Xử lý machines
    let machineCount = 1;
    const machines = {};
    for (const command of newCommands) {
        for (const operation of command.operations) {
            for (const resource of operation.resources) {
                const machineId = resource.machine_id;
                if (!machines[machineId]) {
                    machines[machineId] = machineCount;
                    machineMap[machineCount] = machineId;
                    machineCount++;
                }
            }
        }
    }

    const keyMap = {
        command_map: commandMap,
        machine_map: machineMap,
        worker_map: workerMap,
    };

    const numJobs = newCommands.length;
    const numMachines = Object.keys(machines).length;
    const numWorkers = workers.length;
    const numOperationsPerJob = newCommands.map((job) => job.operations.length);

    const lotSizes = Array(numJobs).fill(0);
    const startDates = Array(numJobs).fill("");
    const hprs = Array.from({ length: numOperations }, () =>
        Array(numMachines).fill(0)
    );
    const availMachines = Array.from({ length: numOperations }, () => []);
    const availWorkers = Array.from({ length: numOperations }, () =>
        Array.from({ length: numMachines }, () => [])
    );

    const maxOperationsPerJob = Math.max(...numOperationsPerJob);
    const jobOperations = Array.from({ length: numJobs + 1 }, () =>
        Array(maxOperationsPerJob * numMachines + 1).fill(-1)
    );
    const jobTotalOperations = Array.from({ length: numJobs + 1 }, () =>
        Array(numOperations * numMachines + 1).fill(-1)
    );
    const jobLots = Array.from({ length: numJobs + 1 }, () =>
        Array(maxOperationsPerJob * numMachines + 1).fill(-1)
    );
    const jobOperationIndex = Array.from({ length: numJobs + 1 }, () =>
        Array(numOperations).fill(-1)
    );
    const jobMainOperation = Array.from({ length: numJobs + 1 }, () =>
        Array(maxOperationsPerJob + 1).fill(-1)
    );
    const prevOperations = Array.from({ length: numJobs + 1 }, () =>
        Array(maxOperationsPerJob * numMachines + 1).fill(-1)
    );

    const machinesAvailStartTime = Array.from(
        { length: numMachines },
        () => []
    );
    const machinesAvailEndTime = Array.from({ length: numMachines }, () => []);
    const workersAvailStartTime = Array.from({ length: numWorkers }, () => []);
    const workersAvailEndTime = Array.from({ length: numWorkers }, () => []);

    let opIndex = 0;
    let totalOperationCount = 0;

    for (const job of newCommands) {
        const jobId = job.id;
        const lotSize = job.quantity;
        const startDate = job.start_date;
        lotSizes[jobId - 1] = lotSize;
        startDates[jobId - 1] = startDate;

        let opInJobCount = 1;
        let mainOperationInJob = 1;

        for (const operation of job.operations) {
            const preOperation = operation.prevOperation;
            const prevOperationId =
                Array.isArray(preOperation) && preOperation.length > 0
                    ? preOperation[0]
                    : preOperation;

            jobOperationIndex[jobId][opIndex] = mainOperationInJob;
            jobMainOperation[jobId][mainOperationInJob] = opIndex;

            for (const resource of operation.resources) {
                const machineId = machines[resource.machine_id];
                const minExp = resource.minExp;
                const role = resource.role;

                const availWorker = workers
                    .filter(
                        (worker) => worker.role === role && worker.exp >= minExp
                    )
                    .map((worker) => worker.id);

                const lotIndex = machineId - 1;
                hprs[opIndex][machineId - 1] = resource.hprs;
                availMachines[opIndex].push(machineId);
                availWorkers[opIndex][machineId - 1] = availWorker;

                jobOperations[jobId][opInJobCount] = opIndex;
                jobTotalOperations[jobId][opInJobCount] = totalOperationCount;
                jobLots[jobId][opInJobCount] = lotIndex;

                if (
                    prevOperationId !== null &&
                    jobMainOperation[jobId][prevOperationId] !== undefined
                ) {
                    prevOperations[jobId][opInJobCount] =
                        jobMainOperation[jobId][prevOperationId];
                } else {
                    prevOperations[jobId][opInJobCount] = -1; // Giá trị mặc định nếu không hợp lệ
                }

                opInJobCount++;
                totalOperationCount++;
            }

            opIndex++;
            mainOperationInJob++;
        }
    }

    const parsedDates = startDates.map((date) =>
        DateTime.fromFormat(date, "dd-MM-yyyy")
    );
    const minDate = parsedDates.reduce((min, date) =>
        date < min ? date : min
    );
    const minStartDateStr = minDate.toFormat("dd-MM-yyyy");
    const startDateInHours = parsedDates.map(
        (date) => date.diff(minDate, "hours").hours
    );

    for (const command of inprogressCommands) {
        for (const operation of command.operations) {
            for (const resource of operation.resources) {
                const machineId = machines[resource.machine_id];
                const workerId = findWorker(workers, resource.worker_id);

                const startTime = parseDate(
                    resource.start_date,
                    resource.start_hours
                );
                const endTime = parseDate(
                    resource.end_date,
                    resource.end_hours
                );

                if (startTime > minDate) {
                    machinesAvailStartTime[machineId - 1].push(
                        startTime.diff(minDate, "hours").hours
                    );
                    if (workerId !== null) {
                        workersAvailStartTime[workerId - 1].push(
                            startTime.diff(minDate, "hours").hours
                        );
                    }
                }

                if (endTime > minDate) {
                    machinesAvailEndTime[machineId - 1].push(
                        endTime.diff(minDate, "hours").hours
                    );
                    if (workerId !== null) {
                        workersAvailEndTime[workerId - 1].push(
                            endTime.diff(minDate, "hours").hours
                        );
                    }
                }
            }
        }
    }

    return {
        keyMap,
        numMachines,
        numWorkers,
        numOperations,
        numJobs,
        numOperationsPerJob,
        minStartDateStr,
        startDateInHours,
        availMachines,
        availWorkers,
        lotSizes,
        jobOperations,
        jobLots,
        jobTotalOperations,
        jobOperationIndex,
        prevOperations,
        hprs,
        machinesAvailStartTime,
        machinesAvailEndTime,
        workersAvailStartTime,
        workersAvailEndTime,
    };
}

module.exports = { input };
