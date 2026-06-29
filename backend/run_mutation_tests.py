import json
import os
from scheduler_ga import GeneticScheduler

def run_tests():
    # Load subjects relative to this file's location
    base_dir = os.path.dirname(os.path.abspath(__file__))
    subjects_file = os.path.join(base_dir, "data", "hardware_subjects.json")
    
    with open(subjects_file, "r") as f:
        all_subjects = json.load(f)
    
    # Use a consistent subset of subjects
    selected_subjects = all_subjects[:5]
    days_left = 7
    hours_per_day = 6
    
    print(f"============================================================")
    # GA Parameter comparison (varying only mutation rate)
    # Keeping population size = 50, generations = 100, crossover_rate = 0.8 constant
    pop_size = 50
    generations = 100
    crossover_rate = 0.8
    
    mutation_rates = [0.02, 0.15, 0.50]
    labels = ["Low Mutation (0.02)", "Moderate Mutation (0.15 - Default)", "High Mutation (0.50)"]
    
    print(f"Running 3 Test Cases varying ONLY Mutation Rate:")
    print(f"Constant parameters: Pop Size={pop_size}, Crossover Rate={crossover_rate}, Generations={generations}")
    print(f"============================================================\n")
    
    for label, mutation_rate in zip(labels, mutation_rates):
        print(f"--- Running Test Case: {label} ---")
        scheduler = GeneticScheduler(
            selected_subjects=selected_subjects,
            days_left=days_left,
            hours_per_day=hours_per_day
        )
        
        result = scheduler.run(
            pop_size=pop_size,
            generations=generations,
            crossover_rate=crossover_rate,
            mutation_rate=mutation_rate
        )
        
        metadata = result["metadata"]
        print(f"Initial Best Fitness: {metadata['initial_fitness']}")
        print(f"Final Best Fitness  : {metadata['final_fitness']}")
        print(f"------------------------------------------------------------\n")

if __name__ == "__main__":
    run_tests()
