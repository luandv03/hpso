import random
import numpy as np


def swap(os):
    idx1, idx2 = random.sample(range(len(os)), 2)
    os[idx1], os[idx2] = os[idx2], os[idx1]

    return os


def revert(os):
    start, end = sorted(random.sample(range(len(os)), 2))
    os[start : end + 1] = os[start : end + 1][::-1]

    return os


def mutation(
    first_matrix,
    num_jobs,
    num_machines,
    num_operations,
    num_operations_per_job,
    lot_sizes,
    avail_machines,
    lambda_theshold,
    min_sublot_size,
    beta,
):
    first_matrix = np.zeros((num_machines, num_operations))
    op_index = 0
    for job_index in range(num_jobs):
        lot_size = lot_sizes[job_index]
        for _ in range(num_operations_per_job[job_index]):
            machines = avail_machines[op_index][:]
            tms = len(machines)

            if tms == 1:
                machine = machines[0]
                first_matrix[machine - 1, op_index] = lot_size
            else:
                random_num = np.random.random()
                if random_num < lambda_theshold:
                    machine = np.random.choice(machines)
                    first_matrix[machine - 1, op_index] = lot_size
                else:
                    remaining_lot_size = lot_size
                    aijk = random.randrange(
                        min_sublot_size, int(remaining_lot_size - min_sublot_size), beta
                    )
                    machine = random.choice(machines)
                    first_matrix[machine - 1, op_index] = aijk
                    remaining_lot_size -= aijk
                    machines.remove(machine)

                    tms -= 1
                    while tms > 2 and remaining_lot_size >= min_sublot_size * 2:
                        mui = random.randrange(
                            min_sublot_size,
                            int(remaining_lot_size - min_sublot_size),
                            beta,
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

    return first_matrix


def pox_crossover(p1, p2, num_jobs):
    job_list = [i + 1 for i in range(num_jobs)]

    if len(job_list) < 2:
        return p1

    random_devide_job_index = np.random.randint(1, num_jobs)
    job_set1 = job_list[:random_devide_job_index]
    job_set2 = job_list[random_devide_job_index:]

    c1 = np.ones(len(p1), dtype=int) * (-1)
    c2 = np.ones(len(p1), dtype=int) * (-1)

    for i, op in enumerate(p1):
        if op in job_set1:
            c1[i] = p1[i]
        else:
            c2[i] = p1[i]

    for op in p2:
        if op in job_set2 and -1 in c1:
            c1[np.where(c1 == -1)[0][0]] = op

    for op in p1:
        if op in job_set1 and -1 in c2:
            c2[np.where(c2 == -1)[0][0]] = op

    return c1


def spx_crossover(p1, p2, num_operations):
    cut_point = np.random.randint(1, num_operations)

    c1 = np.hstack((p1[:, :cut_point], p2[:, cut_point:]))

    return c1


def lsa(
    first_matrix, second_matrix, num_operations, hprs, avail_machines, s, beta, decoder
):
    fs1 = 9999
    fs2 = 9999
    c = 0
    for op_index in range(num_operations):
        s1 = np.copy(first_matrix[:, op_index])
        op_avail_machines = avail_machines[op_index]
        lot_size = np.sum(s1)
        selected_machine_index = np.where(s1 > 0)[0][0]
        aijk = s1[selected_machine_index]
        excluding_selected_machine = [
            m - 1 for m in op_avail_machines if m - 1 != selected_machine_index
        ]
        machine_hprs = hprs[op_index, :]
        excluding_selected_machine_hprs = machine_hprs[excluding_selected_machine]

        if aijk == lot_size and excluding_selected_machine_hprs.size > 0:
            s2 = s1.copy()
            aijk -= s
            min_hprs_index = np.argmin(excluding_selected_machine_hprs)
            s2[min_hprs_index] = s
            s2[selected_machine_index] = aijk

            first_matrix1 = first_matrix.copy()
            first_matrix1[:, op_index] = s1
            first_matrix2 = first_matrix.copy()
            first_matrix2[:, op_index] = s2

            fs1 = decoder.decode(first_matrix1, second_matrix)
            fs2 = decoder.decode(first_matrix2, second_matrix)
            if fs2 <= fs1:
                s1 = np.copy(s2)
                fs1 = fs2
        first_matrix[:, op_index] = s1

        while s + beta <= aijk <= lot_size - s:
            s2 = np.copy(s1)
            aijk += beta
            processing_machine = [
                idx for idx in np.where(s1 > 0)[0] if idx != selected_machine_index
            ]

            if len(processing_machine) > 0:
                random_machine_index = np.random.choice(processing_machine)
                s2[random_machine_index] += beta
                s2[selected_machine_index] -= beta

                first_matrix2 = first_matrix.copy()
                first_matrix2[:, op_index] = s2

                fs2 = decoder.decode(first_matrix2, second_matrix)

                if fs2 < fs1:
                    s1 = s2
                    fs1 = fs2
                    c = 1
                else:
                    break
        first_matrix[:, op_index] = s1

        while s <= aijk <= lot_size - s - beta:
            s2 = np.copy(s1)
            aijk += s
            processing_machine = [
                idx
                for idx in np.where(s1 > s + beta)[0]
                if idx != selected_machine_index
            ]
            if len(processing_machine) > 0:
                random_machine_index = np.random.choice(processing_machine)
                s2[random_machine_index] -= beta
                s2[selected_machine_index] += beta

                first_matrix2 = first_matrix.copy()
                first_matrix2[:, op_index] = s2

                fs2 = decoder.decode(first_matrix2, second_matrix)

                if c == 1 and fs2 < fs1:
                    s1 = s2
                    fs1 = fs2
                    c = 1
                elif c != 1 and fs2 <= fs1:
                    s1 = s2
                    fs1 = fs2
                else:
                    break

        for machine in op_avail_machines:
            s2 = np.zeros(len(s1), dtype=float)
            s2[machine - 1] = lot_size

            first_matrix2 = first_matrix.copy()
            first_matrix2[:, op_index] = s2

            fs2 = decoder.decode(first_matrix2, second_matrix)

            if fs2 <= fs1:
                s1 = first_matrix2[:, op_index]
                fs1 = fs2

        first_matrix[:, op_index] = s1

        op_index += 1

    return first_matrix
