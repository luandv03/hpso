const random = require("random");
const math = require("mathjs"); // Thư viện math.js để xử lý ma trận

// Hàm hoán đổi (swap)
function swap(os) {
    const indices = Array.from(Array(os.length).keys());
    const idx1 = indices.splice(
        Math.floor(Math.random() * indices.length),
        1
    )[0];
    const idx2 = indices[Math.floor(Math.random() * indices.length)];
    [os[idx1], os[idx2]] = [os[idx2], os[idx1]];
    return os;
}

// Hàm đảo ngược (revert)
function revert(os) {
    const indices = Array.from(Array(os.length).keys());
    const start = indices.splice(
        Math.floor(Math.random() * indices.length),
        1
    )[0];
    const end = indices[Math.floor(Math.random() * indices.length)];
    const [min, max] = [start, end].sort((a, b) => a - b);
    const reversed = os.slice(min, max + 1).reverse();
    return [...os.slice(0, min), ...reversed, ...os.slice(max + 1)];
}

// Hàm đột biến (mutation)
function mutation(
    firstMatrix,
    numJobs,
    numMachines,
    numOperations,
    numOperationsPerJob,
    lotSizes,
    availMachines,
    lambdaThreshold,
    minSublotSize,
    beta
) {
    const firstMatrixResult = Array.from({ length: numMachines }, () =>
        Array(numOperations).fill(0)
    );

    let opIndex = 0;
    for (let jobIndex = 0; jobIndex < numJobs; jobIndex++) {
        const lotSize = lotSizes[jobIndex];
        for (let i = 0; i < numOperationsPerJob[jobIndex]; i++) {
            const machines = [...availMachines[opIndex]];
            let tms = machines.length;

            if (tms === 1) {
                const machine = machines[0];
                firstMatrixResult[machine - 1][opIndex] = lotSize;
            } else {
                const randomNum = Math.random();
                if (randomNum < lambdaThreshold) {
                    const machine =
                        machines[Math.floor(Math.random() * machines.length)];
                    firstMatrixResult[machine - 1][opIndex] = lotSize;
                } else {
                    let remainingLotSize = lotSize;
                    let aijk = random.int(
                        minSublotSize,
                        remainingLotSize - minSublotSize
                    );
                    const machine = machines.splice(
                        Math.floor(Math.random() * machines.length),
                        1
                    )[0];
                    firstMatrixResult[machine - 1][opIndex] = aijk;
                    remainingLotSize -= aijk;

                    tms--;
                    while (tms > 2 && remainingLotSize >= minSublotSize * 2) {
                        const mui = random.int(
                            minSublotSize,
                            remainingLotSize - minSublotSize
                        );
                        const machine = machines.splice(
                            Math.floor(Math.random() * machines.length),
                            1
                        )[0];
                        firstMatrixResult[machine - 1][opIndex] = mui;
                        remainingLotSize -= mui;
                        tms--;
                    }

                    const lastMachine = machines.pop();
                    firstMatrixResult[lastMachine - 1][opIndex] =
                        remainingLotSize;
                }
            }

            opIndex++;
        }
    }

    return firstMatrixResult;
}

// Hàm POX crossover
function poxCrossover(p1, p2, numJobs) {
    const jobList = Array.from({ length: numJobs }, (_, i) => i + 1);

    if (jobList.length < 2) {
        return p1;
    }

    const randomDivideJobIndex = Math.floor(Math.random() * numJobs);
    const jobSet1 = jobList.slice(0, randomDivideJobIndex);
    const jobSet2 = jobList.slice(randomDivideJobIndex);

    const c1 = Array(p1.length).fill(-1);
    const c2 = Array(p1.length).fill(-1);

    p1.forEach((op, i) => {
        if (jobSet1.includes(op)) {
            c1[i] = p1[i];
        } else {
            c2[i] = p1[i];
        }
    });

    p2.forEach((op) => {
        if (jobSet2.includes(op) && c1.includes(-1)) {
            c1[c1.indexOf(-1)] = op;
        }
    });

    p1.forEach((op) => {
        if (jobSet1.includes(op) && c2.includes(-1)) {
            c2[c2.indexOf(-1)] = op;
        }
    });

    return c1;
}

// Hàm SPX crossover
function spxCrossover(p1, p2, numOperations) {
    const cutPoint = Math.floor(Math.random() * numOperations);
    const c1 = [...p1.slice(0, cutPoint), ...p2.slice(cutPoint)];
    return c1;
}

// Hàm Local Search Adjustment (LSA)
function lsa(
    firstMatrix,
    secondMatrix,
    numOperations,
    hprs,
    availMachines,
    s,
    beta,
    decoder
) {
    let fs1 = 9999;
    let fs2 = 9999;
    let c = 0;

    for (let opIndex = 0; opIndex < numOperations; opIndex++) {
        let s1 = [...firstMatrix.map((row) => row[opIndex])];
        const opAvailMachines = availMachines[opIndex];
        const lotSize = s1.reduce((sum, val) => sum + val, 0);
        const selectedMachineIndex = s1.findIndex((val) => val > 0);
        let aijk = s1[selectedMachineIndex];
        const excludingSelectedMachine = opAvailMachines.filter(
            (m) => m - 1 !== selectedMachineIndex
        );

        const machineHprs = hprs[opIndex];
        const excludingSelectedMachineHprs = excludingSelectedMachine.map(
            (m) => machineHprs[m]
        );

        if (aijk === lotSize && excludingSelectedMachineHprs.length > 0) {
            const s2 = [...s1];
            aijk -= s;
            const minHprsIndex = excludingSelectedMachineHprs.indexOf(
                Math.min(...excludingSelectedMachineHprs)
            );
            s2[minHprsIndex] = s;
            s2[selectedMachineIndex] = aijk;

            const firstMatrix1 = firstMatrix.map((row) => [...row]);
            firstMatrix1.forEach((row, i) => (row[opIndex] = s1[i]));
            const firstMatrix2 = firstMatrix.map((row) => [...row]);
            firstMatrix2.forEach((row, i) => (row[opIndex] = s2[i]));

            fs1 = decoder.decode(firstMatrix1, secondMatrix);
            fs2 = decoder.decode(firstMatrix2, secondMatrix);

            if (fs2 <= fs1) {
                s1 = [...s2];
                fs1 = fs2;
            }
        }

        firstMatrix.forEach((row, i) => (row[opIndex] = s1[i]));

        while (s + beta <= aijk && aijk <= lotSize - s) {
            const s2 = [...s1];
            aijk += beta;
            const processingMachine = s1
                .map((val, idx) =>
                    val > 0 && idx !== selectedMachineIndex ? idx : null
                )
                .filter((idx) => idx !== null);

            if (processingMachine.length > 0) {
                const randomMachineIndex =
                    processingMachine[
                        Math.floor(Math.random() * processingMachine.length)
                    ];
                s2[randomMachineIndex] += beta;
                s2[selectedMachineIndex] -= beta;

                const firstMatrix2 = firstMatrix.map((row) => [...row]);
                firstMatrix2.forEach((row, i) => (row[opIndex] = s2[i]));

                fs2 = decoder.decode(firstMatrix2, secondMatrix);

                if (fs2 < fs1) {
                    s1 = [...s2];
                    fs1 = fs2;
                    c = 1;
                } else {
                    break;
                }
            }
        }

        firstMatrix.forEach((row, i) => (row[opIndex] = s1[i]));

        while (s <= aijk && aijk <= lotSize - s - beta) {
            const s2 = [...s1];
            aijk += s;
            const processingMachine = s1
                .map((val, idx) =>
                    val > s + beta && idx !== selectedMachineIndex ? idx : null
                )
                .filter((idx) => idx !== null);

            if (processingMachine.length > 0) {
                const randomMachineIndex =
                    processingMachine[
                        Math.floor(Math.random() * processingMachine.length)
                    ];
                s2[randomMachineIndex] -= beta;
                s2[selectedMachineIndex] += beta;

                const firstMatrix2 = firstMatrix.map((row) => [...row]);
                firstMatrix2.forEach((row, i) => (row[opIndex] = s2[i]));

                fs2 = decoder.decode(firstMatrix2, secondMatrix);

                if (c === 1 && fs2 < fs1) {
                    s1 = [...s2];
                    fs1 = fs2;
                    c = 1;
                } else if (c !== 1 && fs2 <= fs1) {
                    s1 = [...s2];
                    fs1 = fs2;
                } else {
                    break;
                }
            }
        }

        for (const machine of opAvailMachines) {
            const s2 = Array(s1.length).fill(0);
            s2[machine - 1] = lotSize;

            const firstMatrix2 = firstMatrix.map((row) => [...row]);
            firstMatrix2.forEach((row, i) => (row[opIndex] = s2[i]));

            fs2 = decoder.decode(firstMatrix2, secondMatrix);

            if (fs2 <= fs1) {
                s1 = firstMatrix2.map((row) => row[opIndex]);
                fs1 = fs2;
            }
        }

        firstMatrix.forEach((row, i) => (row[opIndex] = s1[i]));
    }

    return firstMatrix;
}

module.exports = {
    swap,
    revert,
    mutation,
    poxCrossover,
    spxCrossover,
    lsa,
};
