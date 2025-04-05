const math = require("mathjs"); // Thư viện math.js để xử lý ma trận
const { DateTime } = require("luxon"); // Thư viện Luxon để xử lý ngày giờ

class Decode {
    constructor(
        keyMap,
        numMachines,
        numWorkers,
        numOperations,
        numJobs,
        minStartDateStr,
        startDateInHours,
        jobOperations,
        jobLots,
        jobTotalOperations,
        jobOperationIndex,
        prevOperations,
        hprs,
        machinesAvailStartTime,
        machinesAvailEndTime,
        workersAvailStartTime,
        workersAvailEndTime
    ) {
        this.keyMap = keyMap;
        this.numMachines = numMachines;
        this.numWorkers = numWorkers;
        this.numOperations = numOperations;
        this.numJobs = numJobs;
        this.minStartDateStr = minStartDateStr;
        this.startDateInHours = startDateInHours;
        this.jobOperations = jobOperations;
        this.jobLots = jobLots;
        this.jobTotalOperations = jobTotalOperations;
        this.jobOperationIndex = jobOperationIndex;
        this.prevOperations = prevOperations;
        this.hprs = hprs;
        this.machinesAvailStartTime = machinesAvailStartTime;
        this.machinesAvailEndTime = machinesAvailEndTime;
        this.workersAvailStartTime = workersAvailStartTime;
        this.workersAvailEndTime = workersAvailEndTime;
    }

    addHoursToDate(dateStr, hours) {
        const dateFormat = "dd-MM-yyyy";
        const originalDate = DateTime.fromFormat(dateStr, dateFormat);
        const newDate = originalDate.plus({ hours });

        const formattedDate = newDate.toFormat("yyyy-MM-dd");
        const hoursFloat = newDate.hour + newDate.minute / 60.0;

        return [formattedDate, hoursFloat];
    }

    combineTimes(startTimes, endTimes) {
        return startTimes.map((start, index) => [start, endTimes[index]]);
    }

    hoursToTurn(hours) {
        if (hours >= 6 && hours < 14) {
            return 1;
        } else if (hours >= 14 && hours < 22) {
            return 2;
        } else {
            return 3;
        }
    }

    updateOperationTimes(operation, task) {
        if (
            !operation.startDate ||
            task.start_date < operation.startDate ||
            (task.start_date === operation.startDate &&
                task.start_hour < operation.startHour)
        ) {
            operation.startDate = task.start_date;
            operation.startHour = task.start_hour;
        }

        if (
            !operation.endDate ||
            task.end_date > operation.endDate ||
            (task.end_date === operation.endDate &&
                task.end_hour > operation.endHour)
        ) {
            operation.endDate = task.end_date;
            operation.endHour = task.end_hour;
        }
    }

    updateCommandTimes(command, operation) {
        if (
            !command.startDate ||
            operation.startDate < command.startDate ||
            (operation.startDate === command.startDate &&
                operation.startHour < command.startHour)
        ) {
            command.startDate = operation.startDate;
            command.startHour = operation.startHour;
            command.startTurn = this.hoursToTurn(operation.startHour);
        }

        if (
            !command.endDate ||
            operation.endDate > command.endDate ||
            (operation.endDate === command.endDate &&
                operation.endHour > command.endHour)
        ) {
            command.endDate = operation.endDate;
            command.endHour = operation.endHour;
            command.endTurn = this.hoursToTurn(operation.endHour);
        }
    }

    modifyResult(scheduleResult) {
        const commands = [];
        const commandMap = this.keyMap.command_map;
        const machineMap = this.keyMap.machine_map;
        const workerMap = this.keyMap.worker_map;

        for (const [jobId, operations] of Object.entries(scheduleResult)) {
            const command = {
                id: commandMap[parseInt(jobId)],
                workOrders: [],
                startDate: null,
                endDate: null,
                startTurn: null,
                endTurn: null,
            };

            for (const [opInJob, tasks] of Object.entries(operations)) {
                const operation = {
                    id: parseInt(opInJob),
                    tasks: [],
                    startDate: null,
                    endDate: null,
                    startHour: null,
                    endHour: null,
                };

                for (const task of tasks) {
                    const taskDetails = {
                        lot_size: task.lot_size,
                        machine: machineMap[task.machine_index + 1],
                        responsible: workerMap[task.worker_index + 1],
                        startDate: task.start_date,
                        endDate: task.end_date,
                        startHour: task.start_hour,
                        endHour: task.end_hour,
                    };

                    operation.tasks.push(taskDetails);
                    this.updateOperationTimes(operation, task);
                }

                command.workOrders.push(operation);
                this.updateCommandTimes(command, operation);
            }

            commands.push(command);
        }

        return commands;
    }

    decode(firstMatrix, secondMatrix, printResult = false) {
        const os = secondMatrix[0];
        const ma = secondMatrix[1];
        const wa = secondMatrix[2];

        const scheduleResult = {};

        const machineStartTime = Array.from({ length: this.numMachines }, () =>
            Array.from({ length: this.numOperations }, () =>
                Array(this.numMachines).fill(0)
            )
        );
        const machineEndTime = Array.from({ length: this.numMachines }, () =>
            Array.from({ length: this.numOperations }, () =>
                Array(this.numMachines).fill(0)
            )
        );
        const workerStartTime = Array.from({ length: this.numWorkers }, () =>
            Array.from({ length: this.numOperations }, () =>
                Array(this.numMachines).fill(0)
            )
        );
        const workerEndTime = Array.from({ length: this.numWorkers }, () =>
            Array.from({ length: this.numOperations }, () =>
                Array(this.numMachines).fill(0)
            )
        );

        const opCount = {};

        for (const jobId of os) {
            if (!opCount[jobId]) {
                opCount[jobId] = 0;
            }
            opCount[jobId]++;

            const opIndex = this.jobOperations[jobId][opCount[jobId]];
            const prevOperationIndex =
                this.prevOperations[jobId][opCount[jobId]];
            const machineIndex =
                ma[this.jobTotalOperations[jobId][opCount[jobId]]] - 1;
            const workerIndex =
                wa[this.jobTotalOperations[jobId][opCount[jobId]]] - 1;
            const lotIndex = this.jobLots[jobId][opCount[jobId]];

            const sublotSize = firstMatrix[lotIndex][opIndex];
            let proTime = sublotSize / this.hprs[opIndex][machineIndex];
            proTime = Math.ceil(proTime * 2) / 2;

            const allMachineStartTime = [
                ...(Array.isArray(machineStartTime[machineIndex])
                    ? machineStartTime[machineIndex].flat()
                    : []),
                ...(Array.isArray(this.machinesAvailStartTime[machineIndex])
                    ? this.machinesAvailStartTime[machineIndex]
                    : []),
            ];
            const allWorkerStartTime = [
                ...(Array.isArray(workerStartTime[workerIndex])
                    ? workerStartTime[workerIndex].flat()
                    : []),
                ...(Array.isArray(this.workersAvailStartTime[workerIndex])
                    ? this.workersAvailStartTime[workerIndex]
                    : []),
            ];

            const allMachineEndTime = [
                ...(Array.isArray(machineEndTime[machineIndex])
                    ? machineEndTime[machineIndex].flat()
                    : []),
                ...(Array.isArray(this.machinesAvailEndTime[machineIndex])
                    ? this.machinesAvailEndTime[machineIndex]
                    : []),
            ];
            const allWorkerEndTime = [
                ...(Array.isArray(workerEndTime[workerIndex])
                    ? workerEndTime[workerIndex].flat()
                    : []),
                ...(Array.isArray(this.workersAvailEndTime[workerIndex])
                    ? this.workersAvailEndTime[workerIndex]
                    : []),
            ];

            const machineTime = this.combineTimes(
                allMachineStartTime,
                allMachineEndTime
            );
            const workerTime = this.combineTimes(
                allWorkerStartTime,
                allWorkerEndTime
            );

            const interval = [...machineTime, ...workerTime].sort(
                (a, b) => a[0] - b[0]
            );

            let freeStart = 0;
            if (prevOperationIndex !== -1) {
                freeStart = Math.max(
                    ...machineEndTime.map(
                        (row) => row[prevOperationIndex]?.[machineIndex] || 0
                    )
                );
            }

            let currentEnd = freeStart;
            for (const [start, end] of interval) {
                if (start > currentEnd) {
                    if (start - currentEnd >= proTime) {
                        freeStart = currentEnd;
                        break;
                    }
                    currentEnd = end;
                } else {
                    currentEnd = Math.max(currentEnd, end);
                }
            }

            const currentStartTime = freeStart;
            const currentEndTime = freeStart + proTime;

            machineStartTime[machineIndex][opIndex][machineIndex] =
                currentStartTime;
            machineEndTime[machineIndex][opIndex][machineIndex] =
                currentEndTime;
            workerStartTime[workerIndex][opIndex][machineIndex] =
                currentStartTime;
            workerEndTime[workerIndex][opIndex][machineIndex] = currentEndTime;

            const jobIdStr = String(jobId);
            const opInJob = String(this.jobOperationIndex[jobId][opIndex]);

            if (!scheduleResult[jobIdStr]) {
                scheduleResult[jobIdStr] = {};
            }

            if (!scheduleResult[jobIdStr][opInJob]) {
                scheduleResult[jobIdStr][opInJob] = [];
            }

            scheduleResult[jobIdStr][opInJob].push({
                lot_size: sublotSize,
                machine_index: machineIndex,
                worker_index: workerIndex,
                start_date: this.addHoursToDate(
                    this.minStartDateStr,
                    currentStartTime
                )[0],
                start_hour: this.addHoursToDate(
                    this.minStartDateStr,
                    currentStartTime
                )[1],
                end_date: this.addHoursToDate(
                    this.minStartDateStr,
                    currentEndTime
                )[0],
                end_hour: this.addHoursToDate(
                    this.minStartDateStr,
                    currentEndTime
                )[1],
            });
        }

        if (printResult) {
            return this.modifyResult(scheduleResult);
        }

        const fitness = Math.max(
            ...machineEndTime.flat(2).filter((value) => value !== undefined)
        );
        return fitness;
    }
}

module.exports = Decode;
