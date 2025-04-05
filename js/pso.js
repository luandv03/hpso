// Import các thư viện cần thiết
const Particle = require("./particle"); // Đường dẫn đến file particle.js
const Encode = require("./encode"); // Đường dẫn đến file encode.js
const Decode = require("./decode"); // Đường dẫn đến file decode.js
const { input } = require("./input"); // Đường dẫn đến file input.js
const { lsa } = require("./ga"); // Đường dẫn đến file lsa.js
const math = require("mathjs"); // Thư viện math.js để xử lý ma trận

function runAlgorithm(commands, workers, popSize, maxIter) {
    try {
        // Giả lập hàm input để lấy dữ liệu đầu vào
        const {
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
        } = input(commands, workers);

        const lambdaThreshold = 0.3;
        const minSublotSize = 2000;
        const beta = 500;

        // Khởi tạo encoder và decoder
        const decoder = new Decode(
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
        );

        const encoder = new Encode(
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
        );

        // Biến lưu trữ global best
        let gbestFirstMatrix = null;
        let gbestSecondMatrix = null;
        let gbestFitness = null;

        const c1 = 0.75;
        const c2 = 0.75;
        const wStart = 0.9;
        const wEnd = 0.4;

        const pop = [];

        // Khởi tạo quần thể (population)
        for (let i = 0; i < popSize; i++) {
            const particle = new Particle(
                numJobs,
                numOperations,
                numMachines,
                numOperationsPerJob,
                lotSizes,
                hprs,
                availMachines,
                minSublotSize,
                beta,
                encoder,
                decoder
            );
            pop.push(particle);

            if (gbestFitness === null || particle.pbestFitness < gbestFitness) {
                gbestFirstMatrix = math.clone(particle.pbestFirstMatrix);
                gbestSecondMatrix = math.clone(particle.pbestSecondMatrix);
                gbestFitness = particle.pbestFitness;
            }
        }

        // Vòng lặp tối ưu hóa
        for (let iter = 0; iter < maxIter; iter++) {
            const w =
                wStart -
                (wStart - wEnd) * Math.tan(((iter / maxIter) * Math.PI) / 4);

            for (const particle of pop) {
                particle.updatePosition(
                    gbestFirstMatrix,
                    gbestSecondMatrix,
                    w,
                    c1,
                    c2
                );

                if (particle.pbestFitness < gbestFitness) {
                    gbestFirstMatrix = math.clone(particle.pbestFirstMatrix);
                    gbestSecondMatrix = math.clone(particle.pbestSecondMatrix);
                    gbestFitness = particle.pbestFitness;
                }
            }

            const firstMatrixLsa = lsa(
                math.clone(gbestFirstMatrix),
                math.clone(gbestSecondMatrix),
                numOperations,
                hprs,
                availMachines,
                minSublotSize,
                beta,
                decoder
            );

            gbestFirstMatrix = math.clone(firstMatrixLsa);
            gbestFitness = decoder.decode(gbestFirstMatrix, gbestSecondMatrix);
        }

        // Trả về kết quả cuối cùng
        const result = decoder.decode(
            gbestFirstMatrix,
            gbestSecondMatrix,
            true
        );

        return result;
    } catch (e) {
        console.error(`Exception occurred: ${e}`);
        throw e;
    }
}

const fs = require("fs"); // Thư viện để đọc file
const path = require("path"); // Thư viện để xử lý đường dẫn

// Đường dẫn đến file data.json
const filePath = path.join(__dirname, "data.json");

// Hàm đọc file và tạo các biến
function loadData() {
    try {
        // Đọc nội dung file
        const fileContent = fs.readFileSync(filePath, "utf8");

        // Parse nội dung file JSON
        const data = JSON.parse(fileContent);

        // Tạo các biến từ dữ liệu
        const commands = data.commands || [];
        const workers = data.workers || [];
        const popSize = data.pop_size || 10; // Giá trị mặc định là 10
        const maxIter = data.max_iter || 10; // Giá trị mặc định là 10

        // Trả về các biến
        return { commands, workers, popSize, maxIter };
    } catch (error) {
        console.error("Lỗi khi đọc file:", error);
        return null;
    }
}

// Gọi hàm loadData để đọc dữ liệu
const { commands, workers, popSize, maxIter } = loadData();

const r = runAlgorithm(commands, workers, popSize, maxIter);

console.log("Kết quả cuối cùng:", r);

fs.writeFileSync("output.json", JSON.stringify(r, null, 2), "utf8", (err) => {
    if (err) {
        console.error("Lỗi khi ghi file:", err);
    } else {
        console.log("Ghi file thành công!");
    }
});
