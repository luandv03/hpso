import numpy as np
from datetime import datetime, timedelta
from command_input import CommandInput
from worker_input import WorkerInput

def parse_date(date_str, hours):
    date_format = "%d-%m-%Y"

    original_date = datetime.strptime(date_str, date_format)

    new_date = original_date + timedelta(hours=hours)

    return new_date


def find_worker(workers, worker_id):
    worker = next((worker for worker in workers if worker["_id"] == worker_id), None)

    if worker == None:
        return None
    else:
        return worker["id"]


def input(commands: list[CommandInput], workers: list[WorkerInput]):
    new_commands = []
    inprogress_commands = []
    new_command_count = 1
    num_operations = 0
    command_map = {}
    machine_map = {}
    worker_map = {}

    for command in commands:
        if command.status == "new":
            command.id = new_command_count
            new_commands.append(command)
            new_command_count += 1
            num_operations += len(command.operations)
            command_map[command.id] = command.command_id

        elif command.status == "inprogress":
            inprogress_commands.append(command)

    worker_count = 1
    for worker in workers:
        worker.id = worker_count
        worker_map[worker_count] = worker.worker_id
        worker_count += 1

    machine_count = 1
    machines = {}
    for command in new_commands:
        for operations in command.operations:
            for resource in operations.resources:
                machine_id = resource.machine_id
                if machine_id not in machines:
                    machines[machine_id] = machine_count
                    machine_map[machine_count] = machine_id
                    machine_count += 1

    key_map = {
        "command_map": command_map,
        "machine_map": machine_map,
        "worker_map": worker_map,
    }

    num_jobs = len(new_commands)
    num_machines = len(machines)
    num_workers = len(workers)
    num_operations_per_job = []
    for job in new_commands:
        num_operations_per_job.append(len(job.operations))

    lot_sizes = np.zeros(num_jobs)
    start_dates = ["" for _ in range(num_jobs)]
    hprs = np.zeros((num_operations, num_machines))
    avail_machines = [[] for _ in range(num_operations)]
    avail_workers = [[[] for _ in range(num_machines)] for _ in range(num_operations)]
    max_operations_per_job = max(num_operations_per_job)
    job_operations = np.ones(
        (num_jobs + 1, max_operations_per_job * num_machines + 1), dtype=int
    ) * (-1)
    job_total_operations = np.ones(
        (num_jobs + 1, num_operations * num_machines + 1), dtype=int
    ) * (-1)
    job_lots = np.ones(
        (num_jobs + 1, max_operations_per_job * num_machines + 1), dtype=int
    ) * (-1)
    job_operation_index = np.ones((num_jobs + 1, num_operations), dtype=int) * (-1)
    job_main_operation = np.ones(
        (num_jobs + 1, max_operations_per_job + 1), dtype=int
    ) * (-1)
    prev_operations = np.ones(
        (num_jobs + 1, max_operations_per_job * num_machines + 1), dtype=int
    ) * (-1)
    machines_avail_start_time = [[] for _ in range(num_machines)]
    machines_avail_end_time = [[] for _ in range(num_machines)]
    workers_avail_start_time = [[] for _ in range(num_workers)]
    workers_avail_end_time = [[] for _ in range(num_workers)]

    jobs = new_commands

    op_index = 0
    total_operation_count = 0
    for job in jobs:
        job_id = job.id
        lot_size = job.quantity
        start_date = job.start_date
        lot_sizes[job_id - 1] = lot_size
        start_dates[job_id - 1] = start_date
        op_in_job_count = 1
        main_operation_in_job = 1
        for operation in job.operations:
            preOperation = operation.prevOperation
            prev_operation_id = None

            if isinstance(preOperation, int):
                prev_operation_id = preOperation
            elif isinstance(preOperation, list) and len(preOperation) > 0:
                prev_operation_id = preOperation[0]

            job_operation_index[job_id, op_index] = main_operation_in_job
            job_main_operation[job_id, main_operation_in_job] = op_index

            for resource in operation.resources:
                machine_id = machines[resource.machine_id]
                minExp = resource.minExp
                role = resource.role
                avail_worker = [
                    worker.id
                    for worker in workers
                    if worker.role == role and worker.exp >= minExp
                ]
                lot_index = machine_id - 1
                hprs[op_index, machine_id - 1] = resource.hprs
                avail_machines[op_index].append(machine_id)
                avail_workers[op_index][machine_id - 1] = avail_worker

                job_operations[job_id, op_in_job_count] = op_index
                job_total_operations[job_id, op_in_job_count] = total_operation_count
                job_lots[job_id, op_in_job_count] = lot_index

                if prev_operation_id != None:
                    prev_operations[job_id, op_in_job_count] = job_main_operation[
                        job_id, prev_operation_id
                    ]

                op_in_job_count += 1
                total_operation_count += 1

            op_index += 1
            main_operation_in_job += 1

    parsed_dates = [datetime.strptime(st, "%d-%m-%Y") for st in start_dates]
    min_date = min(parsed_dates)
    min_start_date_str = min_date.strftime("%d-%m-%Y")
    start_date_in_hours = [
        (date - min_date).total_seconds() / 3600 for date in parsed_dates
    ]

    for command in inprogress_commands:
        for operations in command.operations:
            for resource in operations.resources:
                _machine_id = resource.machine_id
                if _machine_id in machines:
                    start_time = parse_date(resource.start_date, resource.start_hours)
                    end_time = parse_date(resource.end_date, resource.end_hours)
                    machine_id = machines[_machine_id]
                    worker_id = find_worker(workers, resource.worker_id)

                    if start_time > min_date:
                        machines_avail_start_time[machine_id - 1].append(
                            (start_time - min_date).total_seconds() / 3600
                        )
                        if worker_id != None:
                            workers_avail_start_time[worker_id - 1].append(
                                (start_time - min_date).total_seconds() / 3600
                            )

                    if end_time > min_date:
                        machines_avail_end_time[machine_id - 1].append(
                            (end_time - min_date).total_seconds() / 3600
                        )
                        if worker_id != None:
                            workers_avail_end_time[worker_id - 1].append(
                                (end_time - min_date).total_seconds() / 3600
                            )

    print(prev_operations)
    return (
        key_map,
        num_machines,
        num_workers,
        num_operations,
        num_jobs,
        num_operations_per_job,
        min_start_date_str,
        start_date_in_hours,
        avail_machines,
        avail_workers,
        lot_sizes,
        job_operations,
        job_lots,
        job_total_operations,
        job_operation_index,
        prev_operations,
        hprs,
        machines_avail_start_time,
        machines_avail_end_time,
        workers_avail_start_time,
        workers_avail_end_time,
    )
