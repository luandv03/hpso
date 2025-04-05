import numpy as np
import random
from .input import input
from .decode import Decode


class Encode:
    def __init__(
        self,
        num_machines,
        num_jobs,
        num_operations,
        num_operations_per_job,
        avail_machines,
        avail_workers,
        lot_sizes,
        lambda_theshold,
        min_sublot_size,
        beta,
    ):
        self.num_machines = num_machines
        self.num_jobs = num_jobs
        self.num_operations = num_operations
        self.num_operations_per_job = num_operations_per_job
        self.avail_machines = avail_machines
        self.avail_workers = avail_workers
        self.lot_sizes = lot_sizes
        self.lambda_theshold = lambda_theshold
        self.min_sublot_size = min_sublot_size
        self.beta = beta

    def init_pos(self):
        first_matrix = np.zeros((self.num_machines, self.num_operations))
        second_matrix = []

        op_index = 0
        for job_index in range(self.num_jobs):
            lot_size = self.lot_sizes[job_index]
            for _ in range(self.num_operations_per_job[job_index]):
                machines = self.avail_machines[op_index][:]
                tms = len(machines)

                if tms == 1:
                    machine = machines[0]
                    first_matrix[machine - 1, op_index] = lot_size
                else:
                    random_num = np.random.random()
                    if random_num < self.lambda_theshold:
                        machine = np.random.choice(machines)
                        first_matrix[machine - 1, op_index] = lot_size
                    else:
                        remaining_lot_size = lot_size
                        aijk = random.randrange(
                            self.min_sublot_size,
                            int(remaining_lot_size - self.min_sublot_size),
                            self.beta,
                        )
                        machine = random.choice(machines)
                        first_matrix[machine - 1, op_index] = aijk
                        remaining_lot_size -= aijk
                        machines.remove(machine)

                        tms -= 1
                        while (
                            tms > 2 and remaining_lot_size >= self.min_sublot_size * 2
                        ):
                            mui = random.randint(
                                self.min_sublot_size,
                                int(remaining_lot_size - self.min_sublot_size),
                            )
                            machine = random.choice(machines)
                            aijk += mui
                            first_matrix[machine - 1, op_index] = mui
                            remaining_lot_size -= mui
                            machines.remove(machine)
                            tms -= 1

                        last_machine = machines[-1]
                        first_matrix[last_machine - 1, op_index] = remaining_lot_size

                op_index += 1

        job_list = []
        op_index = 0
        for job_index in range(self.num_jobs):
            for _ in range(self.num_operations_per_job[job_index]):
                job_list.extend([job_index + 1] * len(self.avail_machines[op_index]))
                op_index += 1
        random.shuffle(job_list)

        machine_list = []
        worker_list = []
        for op_index in range(self.num_operations):
            machines = self.avail_machines[op_index][:]  # copy
            for _ in range(len(self.avail_machines[op_index])):
                machine = np.random.choice(machines)
                machine_list.append(machine)
                avail_workers = self.avail_workers[op_index][machine - 1]
                worker = np.random.choice(avail_workers)
                worker_list.append(worker)
                machines.remove(machine)

        second_matrix = np.vstack((job_list, machine_list, worker_list))

        return first_matrix, second_matrix


# if __name__ == "__main__":
#     num_machines, num_workers, num_operations, num_jobs, num_operations_per_job, \
#     min_start_date_str, start_date_in_hours, avail_machines, avail_workers,lot_sizes, \
#     job_operations, job_lots, job_total_operations, prev_operations, hprs, \
#     machines_avail_start_time, machines_avail_end_time, workers_avail_start_time, \
#     workers_avail_end_time = input()

#     lambda_theshold = 0.3
#     min_sublot_size = 2000
#     beta = 500

#     decoder = Decode(
#         num_machines,
#         num_workers,
#         num_operations,
#         num_jobs,
#         min_start_date_str,
#         start_date_in_hours,
#         job_operations,
#         job_lots,
#         job_total_operations,
#         prev_operations,
#         hprs,
#         machines_avail_start_time,
#         machines_avail_end_time,
#         workers_avail_start_time,
#         workers_avail_end_time
#     )

#     encoder = Encode(
#         num_machines,
#         num_jobs,
#         num_operations,
#         num_operations_per_job,
#         avail_machines,
#         avail_workers,
#         lot_sizes,
#         lambda_theshold,
#         min_sublot_size,
#         beta
#     )

#     first_matrix, second_matrix = encoder.init_pos()
#     decoder.decode(first_matrix, second_matrix, True)
