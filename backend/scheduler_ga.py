import random
import math

class GeneticScheduler:
    def __init__(self, selected_subjects, days_left, hours_per_day):
        """
        selected_subjects: List of dicts representing chosen subjects from hardware_subjects.json
        days_left: Number of study days available (int)
        hours_per_day: Suggested study hours per day (float, rounded to nearest integer for slots)
        """
        self.subjects = selected_subjects
        self.num_subjects = len(selected_subjects)
        self.D = int(days_left)
        # Round slots to nearest integer, minimum 1 slot, maximum 12 slots per day
        self.H = max(1, min(12, round(hours_per_day)))
        self.total_slots = self.D * self.H
        
        # Calculate target hours for each subject based on available time
        self.target_hours = self._calculate_target_hours()
        
    def _calculate_target_hours(self):
        total_required = sum(s['required_hours'] for s in self.subjects)
        targets = {}
        for s in self.subjects:
            if total_required > self.total_slots:
                # Scale down proportionally if we don't have enough slots
                scaled = (s['required_hours'] / total_required) * self.total_slots
                targets[s['name']] = max(1, round(scaled))
            else:
                targets[s['name']] = s['required_hours']
        
        # Make sure target hours sum doesn't exceed total slots
        while sum(targets.values()) > self.total_slots:
            # Reduce from the subject with highest target hours
            max_sub = max(targets, key=targets.get)
            if targets[max_sub] > 1:
                targets[max_sub] -= 1
            else:
                break
                
        return targets

    def _generate_chromosome(self):
        # A chromosome is a list of slot allocations (subject index, or -1 for break)
        chromosome = []
        for _ in range(self.total_slots):
            # 85% study chance, 15% break/revision chance
            if random.random() < 0.85 and self.num_subjects > 0:
                chromosome.append(random.randint(0, self.num_subjects - 1))
            else:
                chromosome.append(-1)
        return chromosome

    def evaluate_fitness(self, chromosome):
        if self.num_subjects == 0:
            return 0.0
            
        # 1. Coverage Score (how close are we to target study hours for each subject?)
        allocated_hours = {s['name']: 0 for s in self.subjects}
        break_count = 0
        for gene in chromosome:
            if gene == -1:
                break_count += 1
            else:
                subj_name = self.subjects[gene]['name']
                allocated_hours[subj_name] += 1
                
        coverage_error = sum(abs(allocated_hours[s['name']] - self.target_hours[s['name']]) for s in self.subjects)
        fitness_coverage = max(0.0, 1.0 - (coverage_error / max(1, self.total_slots)))

        # 2. Workload Balance Score (equal distribution of study load across days)
        daily_study_hours = []
        for d in range(self.D):
            day_slots = chromosome[d * self.H : (d + 1) * self.H]
            study_hours = sum(1 for slot in day_slots if slot != -1)
            daily_study_hours.append(study_hours)
            
        mean_hours = sum(daily_study_hours) / self.D
        variance = sum((h - mean_hours)**2 for h in daily_study_hours) / self.D
        # Normalize variance. Max variance is self.H**2
        fitness_balance = max(0.0, 1.0 - (variance / max(1, self.H**2)))

        # 3. Consecutive Study Penalty (limit studying same subject for >2 slots sequentially on same day)
        consecutive_penalty_count = 0
        for d in range(self.D):
            day_slots = chromosome[d * self.H : (d + 1) * self.H]
            if len(day_slots) <= 2:
                continue
            run_length = 1
            for i in range(1, len(day_slots)):
                if day_slots[i] == day_slots[i-1] and day_slots[i] != -1:
                    run_length += 1
                    if run_length > 2:
                        consecutive_penalty_count += 1
                else:
                    run_length = 1
        fitness_consecutive = max(0.0, 1.0 - (consecutive_penalty_count / max(1, self.total_slots)))

        # 4. Spacing Score (distribute study days for each subject)
        spacing_score_total = 0
        for idx in range(self.num_subjects):
            days_studied = set()
            for d in range(self.D):
                day_slots = chromosome[d * self.H : (d + 1) * self.H]
                if idx in day_slots:
                    days_studied.add(d)
            
            target_spacing = min(3, self.D)
            spacing_score_total += min(len(days_studied), target_spacing) / target_spacing
            
        fitness_spacing = spacing_score_total / self.num_subjects

        # Weighted combination: 40% coverage, 20% balance, 20% pattern constraints, 20% spacing
        total_fitness = (
            0.40 * fitness_coverage +
            0.20 * fitness_balance +
            0.20 * fitness_consecutive +
            0.20 * fitness_spacing
        )
        return total_fitness

    def tournament_selection(self, population, fitnesses, k=3):
        selected_indices = random.sample(range(len(population)), k)
        best_idx = max(selected_indices, key=lambda idx: fitnesses[idx])
        return population[best_idx]

    def crossover(self, parent1, parent2):
        if len(parent1) <= 1:
            return parent1.copy(), parent2.copy()
        split_point = random.randint(1, len(parent1) - 1)
        child1 = parent1[:split_point] + parent2[split_point:]
        child2 = parent2[:split_point] + parent1[split_point:]
        return child1, child2

    def mutate(self, chromosome, mutation_rate=0.15):
        mutated = chromosome.copy()
        for idx in range(len(mutated)):
            if random.random() < mutation_rate:
                if random.random() < 0.85 and self.num_subjects > 0:
                    mutated[idx] = random.randint(0, self.num_subjects - 1)
                else:
                    mutated[idx] = -1
        return mutated

    def run(self, pop_size=50, generations=100, crossover_rate=0.8, mutation_rate=0.15):
        if self.num_subjects == 0:
            return {
                "schedule": [],
                "history": [0.0] * generations,
                "metadata": {
                    "generations": generations,
                    "initial_fitness": 0.0,
                    "final_fitness": 0.0,
                    "mutation_rate": mutation_rate,
                    "crossover_rate": crossover_rate
                }
            }

        # Initialize population
        population = [self._generate_chromosome() for _ in range(pop_size)]
        fitness_history = []
        
        # Track initial best
        fitnesses = [self.evaluate_fitness(chrom) for chrom in population]
        initial_best_fitness = max(fitnesses)
        
        for gen in range(generations):
            fitnesses = [self.evaluate_fitness(chrom) for chrom in population]
            best_idx = max(range(len(population)), key=lambda idx: fitnesses[idx])
            best_fitness = fitnesses[best_idx]
            fitness_history.append(best_fitness)
            
            # Select next generation
            next_pop = []
            
            # Elitism: Keep the top 2 candidates
            sorted_indices = sorted(range(len(population)), key=lambda idx: fitnesses[idx], reverse=True)
            next_pop.append(population[sorted_indices[0]].copy())
            next_pop.append(population[sorted_indices[1]].copy())
            
            while len(next_pop) < pop_size:
                p1 = self.tournament_selection(population, fitnesses)
                p2 = self.tournament_selection(population, fitnesses)
                
                # Crossover
                if random.random() < crossover_rate:
                    c1, c2 = self.crossover(p1, p2)
                else:
                    c1, c2 = p1.copy(), p2.copy()
                    
                # Mutation
                c1 = self.mutate(c1, mutation_rate)
                c2 = self.mutate(c2, mutation_rate)
                
                next_pop.extend([c1, c2])
                
            population = next_pop[:pop_size]

        # Get final best solution
        fitnesses = [self.evaluate_fitness(chrom) for chrom in population]
        best_idx = max(range(len(population)), key=lambda idx: fitnesses[idx])
        best_chromosome = population[best_idx]
        final_best_fitness = fitnesses[best_idx]
        
        # Format the optimized timetable schedule
        schedule_output = self._format_schedule(best_chromosome)
        
        return {
            "schedule": schedule_output,
            "history": fitness_history,
            "metadata": {
                "generations": generations,
                "initial_fitness": round(initial_best_fitness, 4),
                "final_fitness": round(final_best_fitness, 4),
                "mutation_rate": mutation_rate,
                "crossover_rate": crossover_rate
            }
        }

    def _format_schedule(self, chromosome):
        schedule = []
        activities = [
            "Theoretical Study & Conceptual Review",
            "Peripheral Circuit Simulation / Diagram Drafting",
            "Solve Numerical Hardware Problems",
            "Active Recall & Technical Term Quiz",
            "Hardware Safety & Solder QC Analysis",
            "Device Driver Code Implementation",
            "Component Layout & Interconnect Review"
        ]
        
        for d in range(self.D):
            day_schedule = {
                "day_number": d + 1,
                "slots": []
            }
            
            day_slots = chromosome[d * self.H : (d + 1) * self.H]
            for slot_idx, gene in enumerate(day_slots):
                if gene == -1:
                    day_schedule["slots"].append({
                        "slot_number": slot_idx + 1,
                        "subject": "Self-Study & Revision Break",
                        "category": "Rest & Integration",
                        "activity": "Consolidate previous notes, clear study fatigue, and review system layouts.",
                        "difficulty": 0
                    })
                else:
                    sub = self.subjects[gene]
                    # Seed random activity based on subject ID and slot to keep it deterministic but interesting
                    act_seed = (sub['id'] + slot_idx + d) % len(activities)
                    day_schedule["slots"].append({
                        "slot_number": slot_idx + 1,
                        "subject": sub["name"],
                        "category": sub["category"],
                        "activity": activities[act_seed],
                        "difficulty": sub["difficulty"]
                    })
            schedule.append(day_schedule)
            
        return schedule
