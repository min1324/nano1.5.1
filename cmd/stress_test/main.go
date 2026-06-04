package main

import (
	"fmt"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"nano/internal/config"
	"nano/internal/service"
)

func main() {
	fmt.Println("========================================")
	fmt.Println("  Goroutine Leak Detection Test")
	fmt.Println("========================================")

	config.C = &config.Config{
		Port:                ":8080",
		UploadDir:           "./stress_test_files",
		MaxStorage:          "10GB",
		MaxStorageBytes:     10 * 1024 * 1024 * 1024,
		PreviewMaxSize:      "10MB",
		PreviewMaxSizeBytes: 10 * 1024 * 1024,
	}

	service.InitFileManager()
	fm := service.FM

	os.RemoveAll(config.C.UploadDir)
	fm.CreateDir("/")

	baseline := captureGoroutines("Baseline (before any test)")

	testGoroutineLeakCreateDelete(fm)
	testGoroutineLeakMoveCopy(fm)
	testGoroutineLeakGetUsedSize(fm)
	testGoroutineLeakLockFile(fm)
	testGoroutineLeakMixedOps(fm)
	testGoroutineLeakRepeatedCycles(fm)

	final := captureGoroutines("Final (after all tests)")

	os.RemoveAll(config.C.UploadDir)

	fmt.Println("")
	fmt.Println("========================================")
	fmt.Println("  Goroutine Leak Test Summary")
	fmt.Println("========================================")
	fmt.Printf("  Baseline goroutines: %d\n", baseline)
	fmt.Printf("  Final goroutines:    %d\n", final)

	if final > baseline+2 {
		fmt.Printf("  WARNING: Goroutine leak detected! (%d extra goroutines)\n", final-baseline)
		printGoroutineStacks()
	} else {
		fmt.Println("  PASS: No goroutine leak detected")
	}
}

func captureGoroutines(label string) int {
	runtime.GC()
	runtime.GC()
	time.Sleep(200 * time.Millisecond)
	n := runtime.NumGoroutine()
	fmt.Printf("  [%s] Goroutines: %d\n", label, n)
	return n
}

func printGoroutineStacks() {
	fmt.Println("")
	fmt.Println("--- Current Goroutine Stacks ---")
	buf := make([]byte, 64*1024)
	n := runtime.Stack(buf, true)
	fmt.Print(string(buf[:n]))
}

func waitForGoroutinesStable() {
	for i := 0; i < 10; i++ {
		runtime.GC()
		time.Sleep(100 * time.Millisecond)
	}
}

func testGoroutineLeakCreateDelete(fm *service.FileManager) {
	fmt.Println("")
	fmt.Println("--- Test: Goroutine Leak - Create/Delete ---")

	const workers = 100
	var wg sync.WaitGroup
	var totalOps atomic.Int64

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for i := 0; i < 50; i++ {
				totalOps.Add(1)
				dirPath := fmt.Sprintf("/gl_dir_%d_%d", id, i)
				filePath := fmt.Sprintf("/gl_file_%d_%d.txt", id, i)

				unlock1 := fm.LockFile(dirPath)
				fm.CreateDir(dirPath)
				unlock1()

				unlock2 := fm.LockFile(filePath)
				fm.WriteFile(filePath, []byte("test"))
				unlock2()

				unlock3 := fm.LockFile(filePath)
				fm.Delete(filePath)
				unlock3()

				unlock4 := fm.LockFile(dirPath)
				fm.Delete(dirPath)
				unlock4()
			}
		}(w)
	}

	wg.Wait()
	waitForGoroutinesStable()

	captureGoroutines("After Create/Delete")
	fmt.Printf("  Ops completed: %d\n", totalOps.Load())
}

func testGoroutineLeakMoveCopy(fm *service.FileManager) {
	fmt.Println("")
	fmt.Println("--- Test: Goroutine Leak - Move/Copy ---")

	const fileCount = 30
	for i := 0; i < fileCount; i++ {
		fm.WriteFile(fmt.Sprintf("/gl_src_%d.txt", i), []byte(fmt.Sprintf("src-%d", i)))
	}
	fm.CreateDir("/gl_dst")

	const workers = 50
	var wg sync.WaitGroup
	var totalOps atomic.Int64

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for i := 0; i < 20; i++ {
				totalOps.Add(1)
				srcPath := fmt.Sprintf("/gl_src_%d.txt", id%fileCount)
				dstPath := fmt.Sprintf("/gl_dst/cp_%d_%d.txt", id, i)

				first, second := srcPath, dstPath
				if first > second {
					first, second = second, first
				}
				unlock1 := fm.LockFile(first)
				unlock2 := fm.LockFile(second)
				fm.Copy(srcPath, dstPath)
				unlock2()
				unlock1()
			}
		}(w)
	}

	wg.Wait()
	waitForGoroutinesStable()

	fm.Delete("/gl_dst")
	for i := 0; i < fileCount; i++ {
		fm.Delete(fmt.Sprintf("/gl_src_%d.txt", i))
	}

	captureGoroutines("After Move/Copy")
	fmt.Printf("  Ops completed: %d\n", totalOps.Load())
}

func testGoroutineLeakGetUsedSize(fm *service.FileManager) {
	fmt.Println("")
	fmt.Println("--- Test: Goroutine Leak - GetUsedSize ---")

	for i := 0; i < 50; i++ {
		fm.WriteFile(fmt.Sprintf("/gl_size_%d.txt", i), make([]byte, 512))
	}

	const workers = 200
	var wg sync.WaitGroup
	var totalOps atomic.Int64

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 50; i++ {
				totalOps.Add(1)
				fm.GetUsedSize()
				fm.InvalidateUsedSizeCache()
			}
		}()
	}

	wg.Wait()
	waitForGoroutinesStable()

	for i := 0; i < 50; i++ {
		fm.Delete(fmt.Sprintf("/gl_size_%d.txt", i))
	}

	captureGoroutines("After GetUsedSize")
	fmt.Printf("  Ops completed: %d\n", totalOps.Load())
}

func testGoroutineLeakLockFile(fm *service.FileManager) {
	fmt.Println("")
	fmt.Println("--- Test: Goroutine Leak - LockFile high contention ---")

	const workers = 100
	const locksPerWorker = 200
	const uniquePaths = 5

	var wg sync.WaitGroup
	var totalOps atomic.Int64

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for i := 0; i < locksPerWorker; i++ {
				totalOps.Add(1)
				path := fmt.Sprintf("/gl_lock_%d", (id+i)%uniquePaths)
				unlock := fm.LockFile(path)
				time.Sleep(time.Microsecond)
				unlock()
			}
		}(w)
	}

	wg.Wait()
	waitForGoroutinesStable()

	captureGoroutines("After LockFile contention")
	fmt.Printf("  Ops completed: %d\n", totalOps.Load())
}

func testGoroutineLeakMixedOps(fm *service.FileManager) {
	fmt.Println("")
	fmt.Println("--- Test: Goroutine Leak - Mixed Ops (5s) ---")

	fm.CreateDir("/gl_mixed")

	const workers = 50
	const duration = 5 * time.Second
	var totalOps atomic.Int64

	done := make(chan struct{})
	time.AfterFunc(duration, func() { close(done) })

	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			i := 0
			for {
				select {
				case <-done:
					return
				default:
					totalOps.Add(1)
					i++
					path := fmt.Sprintf("/gl_mixed/w_%d_f_%d.txt", id, i%10)
					switch i % 5 {
					case 0:
						unlock := fm.LockFile(path)
						fm.WriteFile(path, []byte("data"))
						unlock()
					case 1:
						fm.ReadFile(path)
					case 2:
						fm.GetUsedSize()
					case 3:
						fm.ListDir("/gl_mixed")
					case 4:
						fm.Stat(path)
					}
				}
			}
		}(w)
	}

	wg.Wait()
	waitForGoroutinesStable()

	fm.Delete("/gl_mixed")

	captureGoroutines("After Mixed Ops")
	fmt.Printf("  Ops completed: %d\n", totalOps.Load())
}

func testGoroutineLeakRepeatedCycles(fm *service.FileManager) {
	fmt.Println("")
	fmt.Println("--- Test: Goroutine Leak - Repeated Cycles (10 rounds) ---")

	beforeGoroutines := runtime.NumGoroutine()

	for round := 0; round < 10; round++ {
		var wg sync.WaitGroup
		for w := 0; w < 30; w++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()
				for i := 0; i < 20; i++ {
					path := fmt.Sprintf("/gl_cycle_r%d_w%d_i%d.txt", round, id, i)
					unlock := fm.LockFile(path)
					fm.WriteFile(path, []byte("cycle"))
					unlock()

					unlock2 := fm.LockFile(path)
					fm.Delete(path)
					unlock2()

					fm.GetUsedSize()
				}
			}(w)
		}
		wg.Wait()
	}

	waitForGoroutinesStable()

	afterGoroutines := runtime.NumGoroutine()

	fmt.Printf("  Before cycles: %d goroutines\n", beforeGoroutines)
	fmt.Printf("  After 10 cycles: %d goroutines\n", afterGoroutines)

	if afterGoroutines > beforeGoroutines+2 {
		fmt.Printf("  WARNING: Goroutine count grew by %d after 10 cycles!\n", afterGoroutines-beforeGoroutines)
	} else {
		fmt.Println("  PASS: Goroutine count stable across 10 cycles")
	}

	captureGoroutines("After Repeated Cycles")
}
