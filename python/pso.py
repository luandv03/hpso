import json
from input import input
from encode import Encode
from decode import Decode
from particle import Particle
from ga import lsa
import traceback
import numpy as np
import math


def run_algorithm(commands, workers, pop_size, max_iter):
    (
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
    ) = input(commands, workers)

    print(commands, workers)

    lambda_theshold = 0.3
    min_sublot_size = 2000
    beta = 500

    decoder = Decode(
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
    )

    encoder = Encode(
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
    )

    gbest_first_matrix = None
    gbest_second_matrix = None
    gbest_fitness = None
    c1 = 0.75
    c2 = 0.75
    w_start = 0.9
    w_end = 0.4

    pop = []

    try:
        for _ in range(pop_size):
            particle = Particle(
                num_jobs,
                num_operations,
                num_machines,
                num_operations_per_job,
                lot_sizes,
                hprs,
                avail_machines,
                min_sublot_size,
                beta,
                encoder,
                decoder,
            )
            pop.append(particle)

            if gbest_fitness == None or particle.pbest_fitness < gbest_fitness:
                gbest_first_matrix = np.copy(particle.pbest_first_matrix)
                gbest_second_matrix = np.copy(particle.pbest_second_matrix)
                gbest_fitness = particle.pbest_fitness

        for iter in range(max_iter):
            w = w_start - (w_start - w_end) * math.tan((iter / max_iter) * math.pi / 4)
            for particle in pop:
                particle.update_position(
                    gbest_first_matrix, gbest_second_matrix, w, c1, c2
                )

                if particle.pbest_fitness < gbest_fitness:
                    gbest_first_matrix = np.copy(particle.pbest_first_matrix)
                    gbest_second_matrix = np.copy(particle.pbest_second_matrix)
                    gbest_fitness = particle.pbest_fitness

            first_matrix_lsa = lsa(
                np.copy(gbest_first_matrix),
                np.copy(gbest_second_matrix),
                num_operations,
                hprs,
                avail_machines,
                min_sublot_size,
                beta,
                decoder,
            )

            gbest_first_matrix = np.copy(first_matrix_lsa)
            gbest_fitness = decoder.decode(gbest_first_matrix, gbest_second_matrix)

            # print("iter: ", iter, " gbest: ", gbest_fitness)

        result = decoder.decode(gbest_first_matrix, gbest_second_matrix, True)

        print("Final result: ", result)

        return result

    except Exception as e:
        print(f"Exception occurred: {e}")
        print(traceback.format_exc())
        raise e


from command_input import CommandInput
from worker_input import WorkerInput

if __name__ == "__main__":
    # Đọc dữ liệu từ file data.json với mã hóa UTF-8
    with open("data.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    # Chuyển đổi commands và workers thành các đối tượng
    commands = [CommandInput(**cmd) for cmd in data["commands"]]
    workers = [WorkerInput(**worker) for worker in data["workers"]]
    pop_size = data["pop_size"]
    max_iter = data["max_iter"]

    # Chạy thuật toán
    result = run_algorithm(commands, workers, pop_size, max_iter)

    # Ghi kết quả vào file output.json
    with open("output.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=4, ensure_ascii=False)