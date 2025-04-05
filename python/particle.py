import numpy as np
from .ga import swap, revert, mutation, pox_crossover, spx_crossover, lsa


class Particle:
    def __init__(
        self,
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
    ):
        self.num_jobs = num_jobs
        self.num_operations = num_operations
        self.num_machines = num_machines
        self.num_operations_per_job = num_operations_per_job
        self.lot_sizes = lot_sizes
        self.hprs = hprs
        self.avail_machines = avail_machines
        self.min_sublot_size = min_sublot_size
        self.beta = beta
        self.lambda_theshold = 0.3
        self.encoder = encoder
        self.decoder = decoder

        self.pos_first_matrix = None
        self.pos_second_matrix = None

        self.pbest_first_matrix = None
        self.pbest_second_matrix = None

        self.pbest_fitness = None

        self.init_position()

    def init_position(self):
        self.pos_first_matrix, self.pos_second_matrix = self.encoder.init_pos()
        self.pbest_first_matrix = np.copy(self.pos_first_matrix)
        self.pbest_second_matrix = np.copy(self.pos_second_matrix)
        self.pbest_fitness = self.decoder.decode(
            self.pbest_first_matrix, self.pbest_second_matrix
        )

    def update_position(self, gbest_first_matrix, gbest_second_matrix, w, c1, c2):
        r1 = np.random.random()
        r2 = np.random.random()
        r3 = np.random.random()
        r_mutation2 = np.random.random()

        if r1 < w:
            self.pos_first_matrix = mutation(
                np.copy(self.pos_first_matrix),
                self.num_jobs,
                self.num_machines,
                self.num_operations,
                self.num_operations_per_job,
                self.lot_sizes,
                self.avail_machines,
                self.lambda_theshold,
                self.min_sublot_size,
                self.beta,
            )
            if r_mutation2 <= 0.5:
                self.pos_second_matrix[0] = swap(np.copy(self.pos_second_matrix[0]))
            else:
                self.pos_second_matrix[0] = revert(np.copy(self.pos_second_matrix[0]))

        if r2 < c1:
            self.pos_first_matrix = spx_crossover(
                np.copy(self.pos_first_matrix),
                np.copy(self.pbest_first_matrix),
                self.num_operations,
            )

            self.pos_second_matrix[0] = pox_crossover(
                np.copy(self.pos_second_matrix[0]),
                np.copy(self.pbest_second_matrix[0]),
                self.num_jobs,
            )

        if r3 < c2:
            self.pos_first_matrix = spx_crossover(
                np.copy(self.pos_first_matrix),
                np.copy(gbest_first_matrix),
                self.num_operations,
            )
            self.pos_second_matrix[0] = pox_crossover(
                np.copy(self.pos_second_matrix[0]),
                np.copy(gbest_second_matrix[0]),
                self.num_jobs,
            )

        fitness = self.decoder.decode(self.pos_first_matrix, self.pos_second_matrix)

        if fitness < self.pbest_fitness:
            self.pbest_first_matrix = np.copy(self.pos_first_matrix)
            self.pbest_second_matrix = np.copy(self.pos_second_matrix)
            self.pbest_fitness = fitness
