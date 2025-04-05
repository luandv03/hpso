import numpy as np
import math
from datetime import datetime, timedelta


class Decode:
    def __init__(
        self,
        key_map,
        num_machines,
        num_workers,
        num_operations,
        num_jobs,
        min_start_date_str,
        start_date_in_hours,
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
    ):
        self.key_map = key_map
        self.num_machines = num_machines
        self.num_workers = num_workers
        self.num_operations = num_operations
        self.num_jobs = num_jobs
        self.min_start_date_str = min_start_date_str
        self.start_date_in_hours = start_date_in_hours
        self.job_operations = job_operations
        self.job_lots = job_lots
        self.job_total_operations = job_total_operations
        self.job_operation_index = job_operation_index
        self.prev_operations = prev_operations
        self.hprs = hprs
        self.machines_avail_start_time = machines_avail_start_time
        self.machines_avail_end_time = machines_avail_end_time
        self.workers_avail_start_time = workers_avail_start_time
        self.workers_avail_end_time = workers_avail_end_time

    def add_hours_to_date(self, date_str, hours):
        date_format = "%d-%m-%Y"

        original_date = datetime.strptime(date_str, date_format)

        new_date = original_date + timedelta(hours=hours)

        date_str = new_date.strftime("%Y-%m-%d")

        hours_float = new_date.hour + new_date.minute / 60.0

        return date_str, hours_float

    def combine_times(self, start_times, end_times):
        return list(zip(start_times, end_times))

    def hours_to_turn(self, hours):
        if 6 <= hours < 14:
            return 1
        elif 14 <= hours < 22:
            return 2
        else:
            return 3

    def update_operation_times(self, operation, task):
        if (
            operation["startDate"] is None
            or task["start_date"] < operation["startDate"]
        ):
            operation["startDate"] = task["start_date"]
            operation["startHour"] = task["start_hour"]
        elif (
            task["start_date"] == operation["startDate"]
            and task["start_hour"] < operation["startHour"]
        ):
            operation["startHour"] = task["start_hour"]

        if operation["endDate"] is None or task["end_date"] > operation["endDate"]:
            operation["endDate"] = task["end_date"]
            operation["endHour"] = task["end_hour"]
        elif (
            task["end_date"] == operation["endDate"]
            and task["end_hour"] > operation["endHour"]
        ):
            operation["endHour"] = task["end_hour"]

    def update_command_times(self, command, operation):
        if (
            command["startDate"] is None
            or operation["startDate"] < command["startDate"]
        ):
            command["startDate"] = operation["startDate"]
            command["startHour"] = operation["startHour"]
            command["startTurn"] = self.hours_to_turn(operation["startHour"])
        elif operation["startDate"] == command["startDate"]:
            if (
                "startHour" not in command
                or operation["startHour"] < command["startHour"]
            ):
                command["startHour"] = operation["startHour"]
                command["startTurn"] = self.hours_to_turn(operation["startHour"])

        if command["endDate"] is None or operation["endDate"] > command["endDate"]:
            command["endDate"] = operation["endDate"]
            command["endHour"] = operation["endHour"]
            command["endTurn"] = self.hours_to_turn(operation["endHour"])
        elif (
            operation["endDate"] == command["endDate"]
            and operation["endHour"] > command["endHour"]
        ):
            command["endHour"] = operation["endHour"]
            command["endTurn"] = self.hours_to_turn(operation["endHour"])

    def modify_result(self, schedule_result):
        commands = []
        command_map = self.key_map["command_map"]
        machine_map = self.key_map["machine_map"]
        worker_map = self.key_map["worker_map"]

        for job_id, operations in schedule_result.items():
            command = {
                "id": command_map[int(job_id)],
                "workOrders": [],
                "startDate": None,
                "endDate": None,
                "startTurn": None,
                "endTurn": None,
            }
            for op_in_job, tasks in operations.items():
                operation = {
                    "id": op_in_job,
                    "tasks": [],
                    "startDate": None,
                    "endDate": None,
                    "startHour": None,
                    "endHour": None,
                }
                for task in tasks:
                    task_details = {
                        "lot_size": task["lot_size"],
                        "machine": machine_map[task["machine_index"] + 1],
                        "responsible": worker_map[task["worker_index"] + 1],
                        "startDate": task["start_date"],
                        "endDate": task["end_date"],
                        "startHour": task["start_hour"],
                        "endHour": task["end_hour"],
                    }
                    operation["tasks"].append(task_details)

                    self.update_operation_times(operation, task)

                    command["workOrders"].append(operation)

                self.update_command_times(command, operation)

            commands.append(command)
        return commands

    def decode(self, first_matrix, second_matrix, print_result=False):
        os = second_matrix[0]
        ma = second_matrix[1]
        wa = second_matrix[2]

        schedule_result = {}

        machine_start_time = np.zeros(
            (self.num_machines, self.num_operations, self.num_machines), dtype=float
        )  # machine -> operation -> lot
        machine_end_time = np.zeros(
            (self.num_machines, self.num_operations, self.num_machines), dtype=float
        )
        worker_start_time = np.zeros(
            (self.num_workers, self.num_operations, self.num_machines), dtype=float
        )
        worker_end_time = np.zeros(
            (self.num_workers, self.num_operations, self.num_machines), dtype=float
        )

        op_count = {}
        for job_id in os:
            if job_id in op_count:
                op_count[job_id] += 1
            else:
                op_count[job_id] = 1

            op_index = self.job_operations[job_id, op_count[job_id]]
            prev_operation_index = self.prev_operations[job_id, op_count[job_id]]
            machine_index = ma[self.job_total_operations[job_id, op_count[job_id]]] - 1
            worker_index = wa[self.job_total_operations[job_id, op_count[job_id]]] - 1
            lot_index = self.job_lots[job_id, op_count[job_id]]

            sublot_size = first_matrix[lot_index, op_index]
            pro_time = sublot_size / self.hprs[op_index, machine_index]
            pro_time = math.ceil(pro_time * 2) / 2

            all_machine_start_time = np.concatenate(
                (
                    machine_start_time[machine_index].flatten(),
                    self.machines_avail_start_time[machine_index],
                )
            )
            all_worker_start_time = np.concatenate(
                (
                    worker_start_time[worker_index].flatten(),
                    self.workers_avail_start_time[worker_index],
                )
            )

            all_machine_end_time = np.concatenate(
                (
                    machine_end_time[machine_index].flatten(),
                    self.machines_avail_end_time[machine_index],
                )
            )

            all_worker_end_time = np.concatenate(
                (
                    worker_end_time[worker_index].flatten(),
                    self.workers_avail_end_time[worker_index],
                )
            )

            machine_time = self.combine_times(
                all_machine_start_time, all_machine_end_time
            )
            worker_time = self.combine_times(all_worker_start_time, all_worker_end_time)

            interval = machine_time + worker_time

            interval.sort(key=lambda x: x[0])

            free_start = 0
            if prev_operation_index != -1:
                free_start = np.max(machine_end_time[:, prev_operation_index, :])

            current_end = free_start
            for start, end in interval:
                if start > current_end:
                    if start - current_end >= pro_time:
                        free_start = current_end
                        break
                    current_end = end
                else:
                    current_end = max(current_end, end)

            current_start_time = free_start
            current_end_time = free_start + pro_time

            machine_start_time[machine_index, op_index, machine_index] = (
                current_start_time
            )
            machine_end_time[machine_index, op_index, machine_index] = current_end_time
            worker_start_time[worker_index, op_index, machine_index] = (
                current_start_time
            )
            worker_end_time[worker_index, op_index, machine_index] = current_end_time

            job_id = job_id
            op_index = op_index
            op_in_job = self.job_operation_index[job_id, op_index]

            job_id = str(job_id)
            op_in_job = str(op_in_job)

            if job_id not in schedule_result:
                schedule_result[job_id] = {}

            if op_in_job not in schedule_result[job_id]:
                schedule_result[job_id][op_in_job] = []

            schedule_result[job_id][op_in_job].append(
                {
                    "lot_size": sublot_size,
                    "machine_index": machine_index,
                    "worker_index": worker_index,
                    "start_date": self.add_hours_to_date(
                        self.min_start_date_str, current_start_time
                    )[0],
                    "start_hour": self.add_hours_to_date(
                        self.min_start_date_str, current_start_time
                    )[1],
                    "end_date": self.add_hours_to_date(
                        self.min_start_date_str, current_end_time
                    )[0],
                    "end_hour": self.add_hours_to_date(
                        self.min_start_date_str, current_end_time
                    )[1],
                }
            )

        if print_result == True:
            result = self.modify_result(schedule_result)
            return result

        fitness = np.max(machine_end_time)

        return fitness
